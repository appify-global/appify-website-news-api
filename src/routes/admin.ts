import { Router } from "express";
import { generateArticles } from "../cron/generateArticles";
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
