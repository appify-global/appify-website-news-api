import { Router } from "express";
import { Prisma } from "@prisma/client";
import { generateArticles } from "../cron/generateArticles";
import { generateBlogContent } from "../services/contentGenerator";
import { optimizeForSEO } from "../services/seoOptimizer";
import { convertToHTML } from "../services/htmlConverter";
import { parseContentBlocks } from "../services/contentParser";
import { migrateImagesToRailbucket } from "../scripts/migrateImagesToRailbucket";
import { getSignedImageUrl, extractFilenameFromUrl } from "../services/railbucket";
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
// Query params: ?count=N to generate N articles (overrides MAX_ARTICLES_PER_RUN)
adminRouter.post("/generate", async (req, res) => {
  try {
    const fetchAll = req.query.fetchAll === "true" || req.body?.fetchAll === true;
    const count = req.query.count ? parseInt(req.query.count as string) : req.body?.count ? parseInt(req.body.count) : undefined;
    console.log(`[ADMIN] Manual article generation triggered${fetchAll ? " (fetching all RSS items)" : ""}${count ? ` (generating ${count} article(s))` : ""}`);
    
    // Temporarily override MAX_ARTICLES_PER_RUN if count is specified
    const originalMax = process.env.MAX_ARTICLES_PER_RUN;
    if (count !== undefined) {
      process.env.MAX_ARTICLES_PER_RUN = count.toString();
    }
    
    try {
      await generateArticles(fetchAll);
      res.json({ 
        success: true, 
        message: `Article generation started${fetchAll ? " (fetching all RSS items)" : ""}${count ? ` (generating ${count} article(s))` : ""}. Check logs for progress.` 
      });
    } finally {
      // Restore original value
      if (count !== undefined) {
        if (originalMax) {
          process.env.MAX_ARTICLES_PER_RUN = originalMax;
        } else {
          delete process.env.MAX_ARTICLES_PER_RUN;
        }
      }
    }
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
