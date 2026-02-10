import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";

export const newsRouter = Router();

// GET /api/news — List all published articles
newsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const { category, status, featured, limit, offset } = req.query;

    const where: any = {};

    // Default to published articles for public requests
    where.status = (status as string) || "published";

    if (category) {
      where.category = { equals: category as string, mode: "insensitive" };
    }

    if (featured === "true") {
      where.isFeatured = true;
    }

    const articles = await prisma.article.findMany({
      where,
      include: {
        contentBlocks: {
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { date: "desc" },
      take: limit ? parseInt(limit as string) : 50,
      skip: offset ? parseInt(offset as string) : 0,
    });

    // Map to frontend-friendly format
    const mapped = articles.map((article) => ({
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      category: article.category,
      author: article.author,
      imageUrl: article.imageUrl,
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
      content: article.contentBlocks.map((block) => ({
        type: block.type,
        text: block.text,
        src: block.src,
        alt: block.alt,
      })),
    }));

    res.json(mapped);
  } catch (error) {
    console.error("Error fetching articles:", error);
    res.status(500).json({ error: "Failed to fetch articles" });
  }
});

// GET /api/news/:slug — Get single article by slug
newsRouter.get("/:slug", async (req: Request, res: Response) => {
  try {
    const article = await prisma.article.findUnique({
      where: { slug: req.params.slug },
      include: {
        contentBlocks: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!article) {
      return res.status(404).json({ error: "Article not found" });
    }

    res.json({
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      category: article.category,
      author: article.author,
      imageUrl: article.imageUrl,
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
      content: article.contentBlocks.map((block) => ({
        type: block.type,
        text: block.text,
        src: block.src,
        alt: block.alt,
      })),
    });
  } catch (error) {
    console.error("Error fetching article:", error);
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

// POST /api/news — Create a new article (protected by API key)
newsRouter.post("/", async (req: Request, res: Response) => {
  try {
    const {
      slug,
      title,
      excerpt,
      category,
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
    if (!slug || !title || !excerpt || !category || !imageUrl) {
      return res.status(400).json({
        error: "Missing required fields: slug, title, excerpt, category, imageUrl",
      });
    }

    // Check for duplicate source URL
    if (sourceUrl) {
      const existing = await prisma.article.findUnique({
        where: { sourceUrl },
      });
      if (existing) {
        return res.status(409).json({
          error: "Article from this source already exists",
          existingSlug: existing.slug,
        });
      }
    }

    const article = await prisma.article.create({
      data: {
        slug,
        title,
        excerpt,
        category,
        author: author || "Appify",
        imageUrl,
        date: date ? new Date(date) : new Date(),
        isFeatured: isFeatured || false,
        metaTitle,
        metaDescription,
        sourceUrl,
        status: status || "draft",
        contentBlocks: content
          ? {
              create: content.map(
                (
                  block: { type: string; text?: string; src?: string; alt?: string },
                  index: number
                ) => ({
                  type: block.type,
                  text: block.text,
                  src: block.src,
                  alt: block.alt,
                  sortOrder: index,
                })
              ),
            }
          : undefined,
      },
      include: {
        contentBlocks: {
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    res.status(201).json(article);
  } catch (error) {
    console.error("Error creating article:", error);
    res.status(500).json({ error: "Failed to create article" });
  }
});

// PUT /api/news/:slug/publish — Publish a draft article
newsRouter.put("/:slug/publish", async (req: Request, res: Response) => {
  try {
    const article = await prisma.article.update({
      where: { slug: req.params.slug },
      data: { status: "published" },
    });

    res.json({ message: "Article published", slug: article.slug });
  } catch (error) {
    console.error("Error publishing article:", error);
    res.status(500).json({ error: "Failed to publish article" });
  }
});

// DELETE /api/news/:slug — Delete an article
newsRouter.delete("/:slug", async (req: Request, res: Response) => {
  try {
    await prisma.article.delete({
      where: { slug: req.params.slug },
    });

    res.json({ message: "Article deleted" });
  } catch (error) {
    console.error("Error deleting article:", error);
    res.status(500).json({ error: "Failed to delete article" });
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
