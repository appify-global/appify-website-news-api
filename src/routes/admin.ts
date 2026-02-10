import { Router } from "express";
import { Prisma } from "@prisma/client";
import { generateArticles } from "../cron/generateArticles";
import { generateBlogContent } from "../services/contentGenerator";
import { optimizeForSEO } from "../services/seoOptimizer";
import { convertToHTML } from "../services/htmlConverter";
import { parseContentBlocks } from "../services/contentParser";
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
adminRouter.post("/generate", async (_req, res) => {
  try {
    console.log("[ADMIN] Manual article generation triggered");
    await generateArticles();
    res.json({ 
      success: true, 
      message: "Article generation started. Check logs for progress." 
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

// POST /api/admin/regenerate-content - Regenerate content for all published articles (or articles with NULL content)
adminRouter.post("/regenerate-content", async (_req, res) => {
  try {
    console.log("[ADMIN] Content regeneration triggered");
    
    // Regenerate published articles OR articles with NULL content
    // First get all articles, then filter for NULL content in JavaScript
    const allArticles = await prisma.article.findMany({
      where: {
        OR: [
          { status: "published" },
        ],
      },
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
    
    // Also get articles with NULL content (regardless of status)
    const nullContentArticles = await prisma.article.findMany({
      where: {
        content: { equals: Prisma.JsonNull },
      },
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
        content: true,
      },
    });
    
    // Combine and deduplicate by id
    const articleMap = new Map();
    [...allArticles, ...nullContentArticles].forEach(article => {
      articleMap.set(article.id, article);
    });
    const articles = Array.from(articleMap.values()).map(({ content, ...rest }) => rest);
    
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
