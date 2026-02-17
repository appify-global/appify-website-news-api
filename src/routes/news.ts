import { Router } from "express";
import { prisma } from "../lib/prisma";
import https from "https";
import http from "http";

interface ContentBlock {
  type: string;
  text?: string;
  src?: string;
  alt?: string;
}

export const newsRouter = Router();

// GET /api/news — List all published articles
newsRouter.get("/", async (req, res) => {
  try {
    const topics = req.query.topics as string | undefined;
    const status = req.query.status as string | undefined;
    const featured = req.query.featured as string | undefined;
    const limit = req.query.limit as string | undefined;
    const offset = req.query.offset as string | undefined;

    const where: any = {};

    // Default to published articles for public requests
    where.status = status || "published";

    if (topics) {
      where.topics = { equals: topics, mode: "insensitive" };
    }

    if (featured === "true") {
      where.isFeatured = true;
    }

    const articles = await prisma.article.findMany({
      where,
      orderBy: { createdAt: "desc" }, // Sort by creation date (newest first)
      take: limit ? parseInt(limit) : 50,
      skip: offset ? parseInt(offset) : 0,
    });

    // Map to frontend-friendly format
    const baseUrl = process.env.API_BASE_URL || `https://${req.get("host") || "appifyglobalbackend-production.up.railway.app"}`;
    const mapped = articles.map((article) => ({
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      topics: article.topics,
      author: article.author,
      imageUrl: `${baseUrl}/api/news/image/${article.slug}`,
      date: article.date.toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      timestamp: getRelativeTime(article.createdAt),
      isFeatured: article.isFeatured,
      metaTitle: article.metaTitle,
      metaDescription: article.metaDescription,
      status: article.status,
      content: (article.content as any) || [], // Read from JSON column
    }));

    res.json(mapped);
  } catch (error: any) {
    console.error("Error fetching articles:", error);
    console.error("Error stack:", error?.stack);
    res.status(500).json({ 
      error: "Failed to fetch articles",
      message: error?.message || "Unknown error",
      details: process.env.NODE_ENV === "development" ? error?.stack : undefined
    });
  }
});

// GET /api/news/search?q=term — Search articles by title, excerpt, or content
newsRouter.get("/search", async (req, res) => {
  try {
    const q = (req.query.q as string || "").trim();

    if (!q) {
      res.json([]);
      return;
    }

    const articles = await prisma.article.findMany({
      where: {
        status: "published",
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { excerpt: { contains: q, mode: "insensitive" } },
          { topics: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { date: "desc" },
      take: 20,
    });

    // Also filter by content text (JSON column - search client-side)
    const contentMatched = articles.length === 0
      ? await prisma.article.findMany({
          where: { status: "published" },
          orderBy: { date: "desc" },
          take: 50,
        }).then((all) =>
          all.filter((a) => {
            const blocks = (a.content as unknown as ContentBlock[]) || [];
            return blocks.some((b) => b.text?.toLowerCase().includes(q.toLowerCase()));
          }).slice(0, 20)
        )
      : [];

    const allResults = [...articles, ...contentMatched];
    const unique = allResults.filter((a, i, arr) => arr.findIndex((b) => b.id === a.id) === i);

    const baseUrl = process.env.API_BASE_URL || `https://${req.get("host") || "appifyglobalbackend-production.up.railway.app"}`;
    const mapped = unique.map((article) => ({
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      topics: article.topics,
      author: article.author,
      imageUrl: `${baseUrl}/api/news/image/${article.slug}`,
      date: article.date.toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      timestamp: getRelativeTime(article.createdAt),
      isFeatured: article.isFeatured,
      content: (article.content as any) || [],
    }));

    res.json(mapped);
  } catch (error: any) {
    console.error("Error searching articles:", error);
    res.status(500).json({ error: "Failed to search articles" });
  }
});

// GET /api/news/:slug — Get single article by slug
newsRouter.get("/:slug", async (req, res) => {
  try {
    const slug = req.params.slug as string;

    const article = await prisma.article.findUnique({
      where: { slug },
    });

    if (!article) {
      res.status(404).json({ error: "Article not found" });
      return;
    }

    const baseUrl = process.env.API_BASE_URL || `https://${req.get("host") || "appifyglobalbackend-production.up.railway.app"}`;
    res.json({
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      topics: article.topics,
      author: article.author,
      imageUrl: `${baseUrl}/api/news/image/${article.slug}`,
      date: article.date.toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
      timestamp: getRelativeTime(article.createdAt),
      isFeatured: article.isFeatured,
      metaTitle: article.metaTitle,
      metaDescription: article.metaDescription,
      status: article.status,
      content: (article.content as any) || [], // Read from JSON column
    });
  } catch (error) {
    console.error("Error fetching article:", error);
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

// POST /api/news — Create a new article (protected by API key)
newsRouter.post("/", async (req, res) => {
  try {
    const {
      slug,
      title,
      excerpt,
      topics,
      author,
      imageUrl,
      date,
      isFeatured,
      metaTitle,
      metaDescription,
      sourceUrl,
      status,
      content,
    } = req.body;

    // Validate required fields
    if (!slug || !title || !excerpt || !topics || !imageUrl) {
      res.status(400).json({
        error: "Missing required fields: slug, title, excerpt, topics, imageUrl",
      });
      return;
    }

    // Check for duplicate source URL
    if (sourceUrl) {
      const existing = await prisma.article.findUnique({
        where: { sourceUrl },
      });
      if (existing) {
        res.status(409).json({
          error: "Article from this source already exists",
          existingSlug: existing.slug,
        });
        return;
      }
    }

    const article = await prisma.article.create({
      data: {
        slug,
        title,
        excerpt,
        topics,
        author: author || "Appify",
        imageUrl,
        date: date ? new Date(date) : new Date(),
        isFeatured: isFeatured || false,
        metaTitle,
        metaDescription,
        sourceUrl,
        status: status || "draft",
        content: content ? (content as any) : null, // Store as JSON
      },
    });

    res.status(201).json(article);
  } catch (error) {
    console.error("Error creating article:", error);
    res.status(500).json({ error: "Failed to create article" });
  }
});

// PUT /api/news/:slug/publish — Publish a draft article
newsRouter.put("/:slug/publish", async (req, res) => {
  try {
    const slug = req.params.slug as string;

    const article = await prisma.article.update({
      where: { slug },
      data: { status: "published" },
    });

    res.json({ message: "Article published", slug: article.slug });
  } catch (error) {
    console.error("Error publishing article:", error);
    res.status(500).json({ error: "Failed to publish article" });
  }
});

// DELETE /api/news/:slug — Delete an article
newsRouter.delete("/:slug", async (req, res) => {
  try {
    const slug = req.params.slug as string;

    await prisma.article.delete({
      where: { slug },
    });

    res.json({ message: "Article deleted" });
  } catch (error) {
    console.error("Error deleting article:", error);
    res.status(500).json({ error: "Failed to delete article" });
  }
});

// GET /api/news/image/:slug — Proxy image from Railbucket (like booked ai)
newsRouter.get("/image/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;

    // Get article to find image URL
    const article = await prisma.article.findUnique({
      where: { slug },
      select: { imageUrl: true },
    });

    if (!article || !article.imageUrl) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    // Fetch image from Railbucket (signed URL)
    const imageUrl = article.imageUrl;
    const url = new URL(imageUrl);
    const client = url.protocol === "https:" ? https : http;

    client
      .get(imageUrl, (imageRes) => {
        if (imageRes.statusCode !== 200) {
          res.status(imageRes.statusCode || 500).json({ error: "Failed to fetch image" });
          return;
        }

        // Set proper headers for image
        res.setHeader("Content-Type", imageRes.headers["content-type"] || "image/png");
        res.setHeader("Cache-Control", "public, max-age=3600"); // Cache for 1 hour (reduced from 1 year for easier updates)
        res.setHeader("Access-Control-Allow-Origin", "*");

        // Stream image to response
        imageRes.pipe(res);
      })
      .on("error", (error) => {
        console.error("Error proxying image:", error);
        res.status(500).json({ error: "Failed to proxy image" });
      });
  } catch (error) {
    console.error("Error in image proxy:", error);
    res.status(500).json({ error: "Failed to proxy image" });
  }
});

// Helper: relative time string
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "JUST NOW";
  if (diffHours < 24) return `${diffHours} HOUR${diffHours > 1 ? "S" : ""} AGO`;
  if (diffDays < 7) return `${diffDays} DAY${diffDays > 1 ? "S" : ""} AGO`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} WEEK${Math.floor(diffDays / 7) > 1 ? "S" : ""} AGO`;
  return `${Math.floor(diffDays / 30)} MONTH${Math.floor(diffDays / 30) > 1 ? "S" : ""} AGO`;
}
