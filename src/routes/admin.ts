import { Router } from "express";
import { Prisma } from "@prisma/client";
import { generateArticles } from "../cron/generateArticles";
import { generateBlogContent } from "../services/contentGenerator";
import { optimizeForSEO } from "../services/seoOptimizer";
import { convertToHTML } from "../services/htmlConverter";
import { parseContentBlocks } from "../services/contentParser";
import { migrateImagesToRailbucket } from "../scripts/migrateImagesToRailbucket";
import { getSignedImageUrl, extractFilenameFromUrl, deleteImageFromRailbucket } from "../services/railbucket";
import { generateImage } from "../services/imageGenerator";
import { generateExcerpt } from "../services/excerptGenerator";
import { generateBlogTitle } from "../services/titleGenerator";
import { generateMetaDescription } from "../services/metaDescriptionGenerator";
import { prisma } from "../lib/prisma";

export const adminRouter = Router();

// API Key middleware
adminRouter.use((req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

// POST /api/admin/generate - Trigger article generation
// Query params: ?fetchAll=true to fetch all RSS items (including older ones)
adminRouter.post("/generate", async (req, res) => {
  try {
    const fetchAll = req.query.fetchAll === "true" || req.body?.fetchAll === true;
    console.log(`[ADMIN] Manual article generation triggered${fetchAll ? " (fetching all RSS items)" : ""}`);
    await generateArticles(fetchAll);
    res.json({ 
      success: true, 
      message: `Article generation started${fetchAll ? " (fetching all RSS items)" : ""}. Check logs for progress.` 
    });
  } catch (error: any) {
    console.error("[ADMIN] Generation error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/admin/publish-all - Publish all pending articles
adminRouter.post("/publish-all", async (_req, res) => {
  try {
    const result = await prisma.article.updateMany({
      where: { status: "pending_review" },
      data: { status: "published" },
    });
    
    res.json({ 
      success: true, 
      message: `Published ${result.count} articles` 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/admin/unpublish-articles - Unpublish specific articles
adminRouter.post("/unpublish-articles", async (req, res) => {
  try {
    const { articleTitles } = req.body;
    
    if (!articleTitles || !Array.isArray(articleTitles) || articleTitles.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please provide an array of article titles in the 'articleTitles' field",
      });
    }

    console.log(`[ADMIN] Unpublishing ${articleTitles.length} articles...`);
    
    const results = [];
    
    for (const searchTitle of articleTitles) {
      try {
        // Find the article (case-insensitive partial match)
        const article = await prisma.article.findFirst({
          where: {
            title: {
              contains: searchTitle,
              mode: 'insensitive'
            }
          },
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
          },
        });

        if (!article) {
          results.push({
            title: searchTitle,
            success: false,
            error: "Article not found",
          });
          continue;
        }

        if (article.status !== "published") {
          results.push({
            title: article.title,
            success: false,
            error: `Article is not published (current status: ${article.status})`,
          });
          continue;
        }

        console.log(`[ADMIN] Unpublishing: ${article.title}`);

        // Update article status to pending_review
        await prisma.article.update({
          where: { id: article.id },
          data: { status: "pending_review" },
        });

        results.push({
          title: article.title,
          slug: article.slug,
          success: true,
          newStatus: "pending_review",
        });

        console.log(`[ADMIN] ✅ Unpublished: ${article.title}`);
        
      } catch (error: any) {
        console.error(`[ADMIN] Error processing "${searchTitle}":`, error);
        results.push({
          title: searchTitle,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    
    res.json({
      success: true,
      message: `Unpublished ${successCount} articles, ${articleTitles.length - successCount} failed`,
      results: results,
    });
  } catch (error: any) {
    console.error("[ADMIN] Error unpublishing articles:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// DELETE /api/admin/delete-recent - Delete recently created articles (last N articles or last X hours)
adminRouter.delete("/delete-recent", async (req, res) => {
  try {
    const count = parseInt(req.query.count as string) || 10; // Default: delete last 10 articles
    const hours = parseInt(req.query.hours as string); // Optional: delete articles from last X hours
    
    let articlesToDelete: Array<{ id: string; sourceUrl: string | null; title: string }> = [];
    
    if (hours) {
      // Delete articles created in the last X hours
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - hours);
      articlesToDelete = await prisma.article.findMany({
        where: { createdAt: { gte: cutoffDate } },
        select: { id: true, sourceUrl: true, title: true },
      });
    } else {
      // Delete last N articles by creation date
      articlesToDelete = await prisma.article.findMany({
        orderBy: { createdAt: "desc" },
        take: count,
        select: { id: true, sourceUrl: true, title: true },
      });
    }
    
    // Log what we're deleting (for potential restoration)
    console.log(`[ADMIN] Deleting ${articlesToDelete.length} articles:`);
    articlesToDelete.forEach(article => {
      console.log(`  - ${article.title} (${article.sourceUrl || 'no source URL'})`);
    });
    
    const result = await prisma.article.deleteMany({
      where: { id: { in: articlesToDelete.map(a => a.id) } },
    });
    
    res.json({ 
      success: true, 
      message: `Deleted ${result.count} recent article(s)`,
      deleted: articlesToDelete.map(a => ({ title: a.title, sourceUrl: a.sourceUrl }))
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/admin/restore-from-urls - Regenerate articles from source URLs
adminRouter.post("/restore-from-urls", async (req, res) => {
  try {
    const { sourceUrls }: { sourceUrls: string[] } = req.body;
    
    if (!sourceUrls || !Array.isArray(sourceUrls) || sourceUrls.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "sourceUrls array is required" 
      });
    }
    
    console.log(`[ADMIN] Attempting to restore ${sourceUrls.length} articles from source URLs...`);
    
    // Fetch RSS items and find matching ones
    const { fetchAllRSSItems } = await import("../services/rss");
    const allItems = await fetchAllRSSItems(200); // Fetch more to find matches
    
    const itemsToRegenerate = allItems.filter(item => 
      sourceUrls.includes(item.link)
    );
    
    if (itemsToRegenerate.length === 0) {
      return res.json({ 
        success: false, 
        message: "No matching RSS items found for the provided source URLs" 
      });
    }
    
    // Regenerate articles for these items
    const { generateArticles } = await import("../cron/generateArticles");
    // We'll need to modify generateArticles to accept specific items, but for now, 
    // we can manually process these items
    
    res.json({ 
      success: true, 
      message: `Found ${itemsToRegenerate.length} matching items. Regeneration would need manual processing.`,
      found: itemsToRegenerate.map(item => ({ title: item.title, url: item.link }))
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/admin/regenerate-article - Regenerate content for a specific article by title
adminRouter.post("/regenerate-article", async (req, res) => {
  try {
    const { articleTitle } = req.body;
    
    if (!articleTitle) {
      return res.status(400).json({
        success: false,
        error: "Please provide 'articleTitle' in the request body",
      });
    }

    console.log(`[ADMIN] Regenerating article: ${articleTitle}`);
    
    // Find the article
    const article = await prisma.article.findFirst({
      where: {
        title: {
          contains: articleTitle,
          mode: 'insensitive'
        }
      },
      select: {
        id: true,
        slug: true,
        title: true,
        sourceUrl: true,
        topics: true,
        metaDescription: true,
      },
    });

    if (!article) {
      return res.status(404).json({
        success: false,
        error: "Article not found",
      });
    }

    console.log(`[ADMIN] Found article: ${article.slug}`);

    // Create mock RSS item with the article title
    const mockItem = {
      title: article.title,
      link: article.sourceUrl || `https://example.com/${article.slug}`,
      content: "",
      contentSnippet: article.metaDescription || "",
      pubDate: new Date().toISOString(),
    };
    
    // Regenerate content using new method (no SEO rewriting, direct content usage)
    console.log(`[ADMIN] Generating new content with new method...`);
    const rawBlog = await generateBlogContent(mockItem);
    console.log(`[ADMIN] Content generated, length: ${rawBlog.length} characters`);
    
    // Extract topics from RSS item (simple detection, no content rewriting)
    const titleLower = (article.title || "").toLowerCase();
    const topicMatches: string[] = [];
    if (titleLower.includes("ai") || titleLower.includes("artificial intelligence")) {
      topicMatches.push("AI");
    }
    if (titleLower.includes("automation")) {
      topicMatches.push("Automation");
    }
    if (titleLower.includes("web")) {
      topicMatches.push("Web");
    }
    if (titleLower.includes("startup") || titleLower.includes("venture capital")) {
      topicMatches.push("Startups");
    }
    if (titleLower.includes("web3") || titleLower.includes("blockchain") || titleLower.includes("crypto")) {
      topicMatches.push("Web3");
    }
    if (titleLower.includes("design")) {
      topicMatches.push("Design");
    }
    const topics = topicMatches.length > 0 ? topicMatches.join(", ") : "AI";
    console.log(`[ADMIN] Extracted topics: ${topics}`);
    
    // Use content directly (already in HTML format with outline headings)
    const htmlContent = rawBlog; // Content already has proper HTML headings from outline
    
    // Parse content blocks
    const contentBlocks = parseContentBlocks(htmlContent);
    
    // Generate new title, meta description, and excerpt
    const blogTitle = await generateBlogTitle(htmlContent, article.title);
    const metaDescription = await generateMetaDescription(htmlContent);
    const excerpt = await generateExcerpt(htmlContent, article.title);
    
    // Store as JSON
    const contentJson = contentBlocks.map((block) => ({
      type: block.type,
      text: block.text || null,
      src: block.src || null,
      alt: block.alt || null,
    }));
    
    // Update article with new content
    await prisma.article.update({
      where: { id: article.id },
      data: {
        title: blogTitle,
        excerpt: excerpt,
        metaDescription: metaDescription.slice(0, 160),
        metaTitle: blogTitle.slice(0, 60), // Meta title max 60 chars
        topics: topics,
        content: contentJson as any,
      },
    });
    
    console.log(`[ADMIN] ✅ Regenerated: ${article.slug}`);
    
    res.json({
      success: true,
      message: `Article regenerated successfully`,
      article: {
        slug: article.slug,
        title: blogTitle,
        excerpt: excerpt,
      },
    });
  } catch (error: any) {
    console.error("[ADMIN] Regenerate article error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/admin/regenerate-content - Regenerate content for all published articles (or articles with NULL content)
adminRouter.post("/regenerate-content", async (_req, res) => {
  try {
    console.log("[ADMIN] Content regeneration triggered");
    
    // Regenerate published articles OR articles with NULL content
    // Fetch all articles and filter in JavaScript (Prisma JSON null filtering is tricky)
    const allArticles = await prisma.article.findMany({
      select: {
        id: true,
        slug: true,
        title: true,
        sourceUrl: true,
        status: true,
        topics: true,
        imageUrl: true,
        excerpt: true,
        metaDescription: true,
        content: true, // Include content to check for null
      },
    });
    
    // Filter: published articles OR articles with NULL content
    const articles = allArticles
      .filter(article => 
        article.status === "published" || 
        article.content === null
      )
      .map(({ content, ...rest }) => rest); // Remove content from select
    
    if (articles.length === 0) {
      return res.json({ 
        success: true, 
        message: "No published articles to regenerate" 
      });
    }
    
    let regenerated = 0;
    let failed = 0;
    
    for (const article of articles) {
      try {
        // Create mock RSS item
        const mockItem = {
          title: article.title,
          link: article.sourceUrl || `https://example.com/${article.slug}`,
          content: "",
          pubDate: new Date().toISOString(),
        };
        
        // Regenerate content
        const rawBlog = await generateBlogContent(mockItem);
        const seoResult = await optimizeForSEO(rawBlog);
        const htmlContent = await convertToHTML(seoResult.optimizedContent);
        const contentBlocks = parseContentBlocks(htmlContent);
        
        // Store as JSON
        const contentJson = contentBlocks.map((block) => ({
          type: block.type,
          text: block.text || null,
          src: block.src || null,
          alt: block.alt || null,
        }));
        
        // Update article
        await prisma.article.update({
          where: { id: article.id },
          data: { content: contentJson as any },
        });
        
        regenerated++;
        console.log(`[ADMIN] Regenerated: ${article.slug}`);
      } catch (error: any) {
        failed++;
        console.error(`[ADMIN] Failed to regenerate ${article.slug}:`, error.message);
      }
    }
    
    res.json({ 
      success: true, 
      message: `Regenerated ${regenerated} articles, ${failed} failed` 
    });
  } catch (error: any) {
    console.error("[ADMIN] Regeneration error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/admin/migrate-images - Migrate all existing article images to Railbucket
adminRouter.post("/migrate-images", async (_req, res) => {
  try {
    console.log("[ADMIN] Image migration to Railbucket triggered");
    
    // Run migration (this will log progress)
    await migrateImagesToRailbucket();
    
    res.json({ 
      success: true, 
      message: "Image migration completed. Check logs for details." 
    });
  } catch (error: any) {
    console.error("[ADMIN] Image migration error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// POST /api/admin/regenerate-signed-urls - Regenerate signed URLs for all Railbucket images
adminRouter.post("/regenerate-signed-urls", async (_req, res) => {
  try {
    console.log("[ADMIN] Regenerating signed URLs for Railbucket images...");
    
    // Get all articles with Railbucket images (containing t3.storageapi.dev)
    const articles = await prisma.article.findMany({
      where: {
        imageUrl: {
          contains: "t3.storageapi.dev",
        },
      },
      select: {
        id: true,
        title: true,
        imageUrl: true,
      },
    });

    if (articles.length === 0) {
      return res.json({ 
        success: true, 
        message: "No Railbucket images found to regenerate." 
      });
    }

    let regenerated = 0;
    let failed = 0;

    for (const article of articles) {
      try {
        // Extract filename from URL
        const filename = extractFilenameFromUrl(article.imageUrl || "");
        if (!filename) {
          console.warn(`[ADMIN] Could not extract filename from: ${article.imageUrl}`);
          failed++;
          continue;
        }

        // Generate new signed URL
        const signedUrl = await getSignedImageUrl(filename);

        // Update article with new signed URL
        await prisma.article.update({
          where: { id: article.id },
          data: { imageUrl: signedUrl },
        });

        regenerated++;
        console.log(`[ADMIN] Regenerated signed URL for: ${article.title.substring(0, 50)}...`);
      } catch (error: any) {
        failed++;
        console.error(`[ADMIN] Failed to regenerate signed URL for "${article.title}":`, error.message);
      }
    }

    res.json({ 
      success: true, 
      message: `Regenerated signed URLs for ${regenerated} images, ${failed} failed. Check logs for details.` 
    });
  } catch (error: any) {
    console.error("[ADMIN] Signed URL regeneration error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET /api/admin/stats - Get article statistics
adminRouter.get("/stats", async (_req, res) => {
  try {
    const [total, published, pending] = await Promise.all([
      prisma.article.count(),
      prisma.article.count({ where: { status: "published" } }),
      prisma.article.count({ where: { status: "pending_review" } }),
    ]);
    
    res.json({
      total,
      published,
      pending,
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// DELETE /api/admin/article/:slug - Delete article and its Railbucket image
adminRouter.delete("/article/:slug", async (req, res) => {
  try {
    const slug = req.params.slug as string;
    
    // Get article to find image URL
    const article = await prisma.article.findUnique({
      where: { slug },
      select: { id: true, title: true, slug: true, imageUrl: true },
    });

    if (!article) {
      return res.status(404).json({ 
        success: false, 
        error: "Article not found" 
      });
    }

    // Extract filename from image URL if it's a Railbucket image
    let imageFilename: string | null = null;
    if (article.imageUrl && (article.imageUrl.includes('railbucket') || article.imageUrl.includes('t3.storageapi.dev'))) {
      imageFilename = extractFilenameFromUrl(article.imageUrl);
    }

    // Delete the article
    await prisma.article.delete({
      where: { id: article.id },
    });

    // Delete image from Railbucket if it exists there
    let imageDeleted = false;
    if (imageFilename) {
      try {
        await deleteImageFromRailbucket(imageFilename);
        imageDeleted = true;
        console.log(`[ADMIN] Deleted image from Railbucket: ${imageFilename}`);
      } catch (error: any) {
        console.error(`[ADMIN] Failed to delete image from Railbucket: ${error.message}`);
      }
    }

    res.json({ 
      success: true, 
      message: `Article deleted${imageDeleted ? ' and image removed from Railbucket' : ''}`,
      deleted: {
        title: article.title,
        slug: article.slug,
        imageDeleted: imageDeleted,
        imageFilename: imageFilename,
      }
    });
  } catch (error: any) {
    console.error("[ADMIN] Delete error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// DELETE /api/admin/delete-image/:filename - Delete an image from Railbucket
adminRouter.delete("/delete-image/:filename", async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    
    await deleteImageFromRailbucket(filename);
    
    res.json({ 
      success: true, 
      message: `Image deleted from Railbucket: ${filename}`,
      filename: filename
    });
  } catch (error: any) {
    console.error("[ADMIN] Image delete error:", error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// GET /api/admin/check-images - Check image URLs for recent articles
adminRouter.get("/check-images", async (_req, res) => {
  try {
    const recentArticles = await prisma.article.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        slug: true,
        imageUrl: true,
        sourceUrl: true,
        createdAt: true,
      },
    });

    const articlesWithSource = recentArticles.map((article) => {
      let imageSource = "Unknown";
      if (article.imageUrl.includes("railbucket") || article.imageUrl.includes("t3.storageapi.dev")) {
        imageSource = "Railbucket (from article/RSS)";
      } else if (article.imageUrl.includes("grok") || article.imageUrl.includes("xai")) {
        imageSource = "Grok-generated";
      } else if (article.imageUrl.includes("unsplash")) {
        imageSource = "Placeholder (Unsplash)";
      } else if (article.imageUrl.includes("media.wired.com") || article.imageUrl.includes("media.")) {
        imageSource = "Direct from source (not uploaded)";
      }

      return {
        title: article.title,
        slug: article.slug,
        imageUrl: article.imageUrl,
        imageSource,
        sourceUrl: article.sourceUrl,
        createdAt: article.createdAt,
      };
    });

    res.json({
      success: true,
      articles: articlesWithSource,
    });
  } catch (error: any) {
    console.error("[Admin] Error checking images:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/admin/regenerate-images - Regenerate images for specific articles using new Grok custom prompts
adminRouter.post("/regenerate-images", async (req, res) => {
  try {
    const { articleTitles } = req.body;
    
    if (!articleTitles || !Array.isArray(articleTitles) || articleTitles.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please provide an array of article titles in the 'articleTitles' field",
      });
    }

    console.log(`[ADMIN] Regenerating images for ${articleTitles.length} articles...`);
    
    const results = [];
    
    for (const searchTitle of articleTitles) {
      try {
        // Find the article (case-insensitive partial match)
        const article = await prisma.article.findFirst({
          where: {
            title: {
              contains: searchTitle,
              mode: 'insensitive'
            }
          },
          select: {
            id: true,
            title: true,
            slug: true,
            topics: true,
            metaDescription: true,
            imageUrl: true,
          },
        });

        if (!article) {
          results.push({
            title: searchTitle,
            success: false,
            error: "Article not found",
          });
          continue;
        }

        console.log(`[ADMIN] Processing: ${article.title}`);

        // Delete old image from Railbucket if it exists
        let oldImageDeleted = false;
        if (article.imageUrl && (article.imageUrl.includes('railbucket') || article.imageUrl.includes('t3.storageapi.dev'))) {
          try {
            const imageFilename = extractFilenameFromUrl(article.imageUrl);
            if (imageFilename) {
              await deleteImageFromRailbucket(imageFilename);
              oldImageDeleted = true;
              console.log(`[ADMIN] Deleted old image: ${imageFilename}`);
            }
          } catch (error: any) {
            console.warn(`[ADMIN] Could not delete old image: ${error.message}`);
          }
        }

        // Generate new image with custom prompt (using the new generateImagePrompt system)
        console.log(`[ADMIN] Generating new image with Grok (custom OpenAI prompt)...`);
        const newImageUrl = await generateImage(
          article.title, 
          article.topics || 'AI', 
          article.metaDescription || undefined
        );
        console.log(`[ADMIN] New image generated: ${newImageUrl.substring(0, 80)}...`);

        // Update article with new image
        await prisma.article.update({
          where: { id: article.id },
          data: { imageUrl: newImageUrl },
        });

        results.push({
          title: article.title,
          slug: article.slug,
          success: true,
          newImageUrl: newImageUrl,
          oldImageDeleted: oldImageDeleted,
        });

        console.log(`[ADMIN] ✅ Updated: ${article.title}`);
        
      } catch (error: any) {
        console.error(`[ADMIN] Error processing "${searchTitle}":`, error);
        results.push({
          title: searchTitle,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Regenerated images for ${successCount} articles, ${failCount} failed.`,
      results: results,
    });
  } catch (error: any) {
    console.error("[ADMIN] Regenerate images error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST /api/admin/regenerate-excerpts - Regenerate excerpts/summaries for specific articles
adminRouter.post("/regenerate-excerpts", async (req, res) => {
  try {
    const { articleTitles } = req.body;
    
    if (!articleTitles || !Array.isArray(articleTitles) || articleTitles.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Please provide an array of article titles in the 'articleTitles' field",
      });
    }

    console.log(`[ADMIN] Regenerating excerpts for ${articleTitles.length} articles...`);
    
    const results = [];
    
    for (const searchTitle of articleTitles) {
      try {
        // Find the article (case-insensitive partial match)
        const article = await prisma.article.findFirst({
          where: {
            title: {
              contains: searchTitle,
              mode: 'insensitive'
            }
          },
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            content: true,
          },
        });

        if (!article) {
          results.push({
            title: searchTitle,
            success: false,
            error: "Article not found",
          });
          continue;
        }

        console.log(`[ADMIN] Processing: ${article.title}`);

        // Extract content from JSON blocks
        let articleContent = "";
        if (article.content && Array.isArray(article.content)) {
          articleContent = (article.content as any[])
            .filter(block => block.type === 'paragraph' && block.text)
            .map(block => {
              // Remove HTML tags
              let text = block.text.replace(/<[^>]+>/g, ' ');
              // Decode HTML entities
              text = text
                .replace(/&#039;/g, "'")
                .replace(/&apos;/g, "'")
                .replace(/&quot;/g, '"')
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&nbsp;/g, " ");
              return text.trim();
            })
            .filter(text => text.length > 20)
            .join(' ');
        }

        if (!articleContent || articleContent.length < 100) {
          results.push({
            title: article.title,
            success: false,
            error: "Article content is too short or not available",
          });
          continue;
        }

        // Generate new excerpt using OpenAI
        console.log(`[ADMIN] Generating new excerpt with OpenAI...`);
        const newExcerpt = await generateExcerpt(articleContent, article.title);
        console.log(`[ADMIN] New excerpt generated (${newExcerpt.length} chars): ${newExcerpt.substring(0, 100)}...`);

        // Update article with new excerpt
        await prisma.article.update({
          where: { id: article.id },
          data: { excerpt: newExcerpt },
        });

        results.push({
          title: article.title,
          slug: article.slug,
          success: true,
          oldExcerpt: article.excerpt,
          newExcerpt: newExcerpt,
        });

        console.log(`[ADMIN] ✅ Updated: ${article.title}`);
        
      } catch (error: any) {
        console.error(`[ADMIN] Error processing "${searchTitle}":`, error);
        results.push({
          title: searchTitle,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      message: `Regenerated excerpts for ${successCount} articles, ${failCount} failed.`,
      results: results,
    });
  } catch (error: any) {
    console.error("[ADMIN] Regenerate excerpts error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
