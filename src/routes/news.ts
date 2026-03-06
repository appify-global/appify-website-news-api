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

// ---------------------------------------------------------------------------
// In-memory listing cache — articles change hourly via cron, so 60s is safe.
// ---------------------------------------------------------------------------

const LISTING_CACHE_TTL_MS = 60_000;

interface ListingCacheEntry {
  data: string; // pre-serialized JSON
  ts: number;
  key: string;
}

let _listingCache: ListingCacheEntry | null = null;

function getListingCacheKey(where: Record<string, unknown>, take: number, skip: number) {
  return JSON.stringify({ where, take, skip });
}

/** Invalidate listing cache (called after writes). */
export function invalidateListingCache() {
  _listingCache = null;
}

// Prisma select for listing queries — everything EXCEPT the heavy content column.
const LISTING_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  topics: true,
  author: true,
  imageUrl: true,
  date: true,
  createdAt: true,
  isFeatured: true,
  metaTitle: true,
  metaDescription: true,
  status: true,
} as const;

// ---------------------------------------------------------------------------
// GET /api/news — List published articles
// ---------------------------------------------------------------------------

newsRouter.get("/", async (req, res) => {
  try {
    const topics = req.query.topics as string | undefined;
    const status = req.query.status as string | undefined;
    const featured = req.query.featured as string | undefined;
    const limit = req.query.limit as string | undefined;
    const offset = req.query.offset as string | undefined;
    const includeContent = req.query.content === "true";

    const where: Record<string, unknown> = {};
    where.status = status || "published";

    if (topics) {
      where.topics = { equals: topics, mode: "insensitive" };
    }
    if (featured === "true") {
      where.isFeatured = true;
    }

    const take = Math.min(limit ? parseInt(limit) : 50, 100);
    const skip = Math.max(offset ? parseInt(offset) : 0, 0);

    // Check in-memory cache (only for listing-mode requests without content)
    if (!includeContent) {
      const cacheKey = getListingCacheKey(where, take, skip);
      if (_listingCache && _listingCache.key === cacheKey && Date.now() - _listingCache.ts < LISTING_CACHE_TTL_MS) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
        res.setHeader("X-Cache", "HIT");
        res.send(_listingCache.data);
        return;
      }
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        ...(includeContent ? {} : { select: LISTING_SELECT }),
      }),
      prisma.article.count({ where }),
    ]);

    const baseUrl =
      process.env.API_BASE_URL ||
      `https://${req.get("host") || "appifyglobalbackend-production.up.railway.app"}`;

    const mapped = articles.map((article: any) => {
      const imageUrl = `${baseUrl}/api/news/image/${article.slug}`;
      const base: Record<string, unknown> = {
        id: article.id,
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        topics: article.topics,
        author: article.author,
        imageUrl,
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
        openGraph: {
          title: article.metaTitle || article.title,
          description: article.metaDescription || article.excerpt,
          imageUrl,
        },
        twitterCard: {
          title: article.metaTitle || article.title,
          description: article.metaDescription || article.excerpt,
          imageUrl,
        },
      };
      if (includeContent) {
        base.content = (article.content as any) || [];
      }
      return base;
    });

    const page = Math.floor(skip / take) + 1;
    const totalPages = Math.max(1, Math.ceil(total / take));
    const hasMore = skip + articles.length < total;

    const payload = {
      articles: mapped,
      total,
      total_pages: totalPages,
      totalPages,
      has_more: hasMore,
      hasMore,
      page,
      limit: take,
      offset: skip,
    };

    const json = JSON.stringify(payload);

    // Populate cache for listing requests
    if (!includeContent) {
      _listingCache = {
        data: json,
        ts: Date.now(),
        key: getListingCacheKey(where, take, skip),
      };
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      includeContent
        ? "public, max-age=30, stale-while-revalidate=60"
        : "public, max-age=60, stale-while-revalidate=120"
    );
    res.setHeader("X-Cache", "MISS");
    res.send(json);
  } catch (error: any) {
    console.error("Error fetching articles:", error);
    console.error("Error stack:", error?.stack);
    res.status(500).json({
      error: "Failed to fetch articles",
      message: error?.message || "Unknown error",
      details: process.env.NODE_ENV === "development" ? error?.stack : undefined,
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/news/search?q=term — Search articles
// ---------------------------------------------------------------------------

newsRouter.get("/search", async (req, res) => {
  try {
    const q = ((req.query.q as string) || "").trim();

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
      select: LISTING_SELECT,
    });

    // Fallback: content-body text search when metadata search returns nothing
    const contentMatched =
      articles.length === 0
        ? await prisma.article
            .findMany({
              where: { status: "published" },
              orderBy: { date: "desc" },
              take: 50,
            })
            .then((all) =>
              all
                .filter((a) => {
                  const blocks =
                    (a.content as unknown as ContentBlock[]) || [];
                  return blocks.some((b) =>
                    b.text?.toLowerCase().includes(q.toLowerCase())
                  );
                })
                .slice(0, 20)
            )
        : [];

    const allResults = [...articles, ...contentMatched];
    const unique = allResults.filter(
      (a, i, arr) => arr.findIndex((b) => b.id === a.id) === i
    );

    const baseUrl =
      process.env.API_BASE_URL ||
      `https://${req.get("host") || "appifyglobalbackend-production.up.railway.app"}`;

    const mapped = unique.map((article: any) => {
      const imageUrl = `${baseUrl}/api/news/image/${article.slug}`;
      return {
        id: article.id,
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        topics: article.topics,
        author: article.author,
        imageUrl,
        date: article.date.toLocaleDateString("en-AU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }),
        timestamp: getRelativeTime(article.createdAt),
        isFeatured: article.isFeatured,
        content: (article.content as any) || [],
        openGraph: {
          title: article.metaTitle || article.title,
          description: article.metaDescription || article.excerpt,
          imageUrl,
        },
        twitterCard: {
          title: article.metaTitle || article.title,
          description: article.metaDescription || article.excerpt,
          imageUrl,
        },
      };
    });

    res.setHeader("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    res.json(mapped);
  } catch (error: any) {
    console.error("Error searching articles:", error);
    res.status(500).json({ error: "Failed to search articles" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/news/sitemap.xml — Sitemap for crawlers (must be before /:slug)
// ---------------------------------------------------------------------------

newsRouter.get("/sitemap.xml", async (_req, res) => {
  try {
    const siteBaseUrl =
      process.env.FRONTEND_URL ||
      process.env.SITE_URL ||
      `https://${_req.get("host") || "appifyglobalbackend-production.up.railway.app"}`;

    const articles = await prisma.article.findMany({
      where: { status: "published" },
      orderBy: { updatedAt: "desc" },
      select: { slug: true, updatedAt: true },
    });

    const urlEntries = articles
      .map(
        (a) =>
          `  <url><loc>${escapeXml(siteBaseUrl.replace(/\/$/, "") + "/news/" + a.slug)}</loc><lastmod>${a.updatedAt.toISOString()}</lastmod></url>`
      )
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    res.send(xml);
  } catch (error) {
    console.error("Error generating sitemap:", error);
    res.status(500).send('<?xml version="1.0"?><error>Failed to generate sitemap</error>');
  }
});

// ---------------------------------------------------------------------------
// GET /api/news/:slug — Single article (full content)
// ---------------------------------------------------------------------------

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

    const baseUrl =
      process.env.API_BASE_URL ||
      `https://${req.get("host") || "appifyglobalbackend-production.up.railway.app"}`;
    const siteBaseUrl =
      process.env.FRONTEND_URL ||
      process.env.SITE_URL ||
      baseUrl;
    const imageUrl = `${baseUrl}/api/news/image/${article.slug}`;

    const jsonLd = buildArticleJsonLd(
      {
        slug: article.slug,
        title: article.title,
        excerpt: article.excerpt,
        author: article.author,
        date: article.date,
        updatedAt: article.updatedAt,
        metaTitle: article.metaTitle,
        metaDescription: article.metaDescription,
      },
      imageUrl,
      siteBaseUrl
    );

    res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=300");
    res.json({
      id: article.id,
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      topics: article.topics,
      author: article.author,
      imageUrl,
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
      content: (article.content as any) || [],
      jsonLd,
      openGraph: {
        title: article.metaTitle || article.title,
        description: article.metaDescription || article.excerpt,
        imageUrl,
      },
      twitterCard: {
        title: article.metaTitle || article.title,
        description: article.metaDescription || article.excerpt,
        imageUrl,
      },
    });
  } catch (error) {
    console.error("Error fetching article:", error);
    res.status(500).json({ error: "Failed to fetch article" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/news — Create article (protected by API key)
// ---------------------------------------------------------------------------

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

    if (!slug || !title || !excerpt || !topics || !imageUrl) {
      res.status(400).json({
        error: "Missing required fields: slug, title, excerpt, topics, imageUrl",
      });
      return;
    }

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
        content: content ? (content as any) : null,
      },
    });

    invalidateListingCache();
    res.status(201).json(article);
  } catch (error) {
    console.error("Error creating article:", error);
    res.status(500).json({ error: "Failed to create article" });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/news/:slug/publish — Publish a draft
// ---------------------------------------------------------------------------

newsRouter.put("/:slug/publish", async (req, res) => {
  try {
    const slug = req.params.slug as string;

    const article = await prisma.article.update({
      where: { slug },
      data: { status: "published" },
    });

    invalidateListingCache();
    res.json({ message: "Article published", slug: article.slug });
  } catch (error) {
    console.error("Error publishing article:", error);
    res.status(500).json({ error: "Failed to publish article" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/news/:slug — Delete an article
// ---------------------------------------------------------------------------

newsRouter.delete("/:slug", async (req, res) => {
  try {
    const slug = req.params.slug as string;

    await prisma.article.delete({
      where: { slug },
    });

    invalidateListingCache();
    res.json({ message: "Article deleted" });
  } catch (error) {
    console.error("Error deleting article:", error);
    res.status(500).json({ error: "Failed to delete article" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/news/image/:slug — Proxy image from Railbucket
// ---------------------------------------------------------------------------

newsRouter.get("/image/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;

    const article = await prisma.article.findUnique({
      where: { slug },
      select: { imageUrl: true },
    });

    if (!article || !article.imageUrl) {
      res.status(404).json({ error: "Image not found" });
      return;
    }

    const imageUrl = article.imageUrl;
    const url = new URL(imageUrl);
    const client = url.protocol === "https:" ? https : http;

    client
      .get(imageUrl, (imageRes) => {
        if (imageRes.statusCode !== 200) {
          res
            .status(imageRes.statusCode || 500)
            .json({ error: "Failed to fetch image" });
          return;
        }

        res.setHeader(
          "Content-Type",
          imageRes.headers["content-type"] || "image/png"
        );
        res.setHeader("Cache-Control", "public, max-age=86400, immutable");
        res.setHeader("Access-Control-Allow-Origin", "*");

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Build schema.org Article JSON-LD for SEO rich results.
 * Frontend can inject this into <script type="application/ld+json">.
 */
function buildArticleJsonLd(
  article: {
    slug: string;
    title: string;
    excerpt: string;
    author: string;
    date: Date;
    updatedAt: Date;
    metaTitle: string | null;
    metaDescription: string | null;
  },
  imageUrl: string,
  siteBaseUrl: string
): Record<string, unknown> {
  const articleUrl = `${siteBaseUrl}/news/${article.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.metaTitle || article.title,
    description: article.metaDescription || article.excerpt,
    image: imageUrl,
    datePublished: article.date.toISOString(),
    dateModified: article.updatedAt.toISOString(),
    author: {
      "@type": "Person",
      name: article.author,
    },
    publisher: {
      "@type": "Organization",
      name: "Appify",
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
  };
}

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return "JUST NOW";
  if (diffHours < 24)
    return `${diffHours} HOUR${diffHours > 1 ? "S" : ""} AGO`;
  if (diffDays < 7)
    return `${diffDays} DAY${diffDays > 1 ? "S" : ""} AGO`;
  if (diffDays < 30)
    return `${Math.floor(diffDays / 7)} WEEK${Math.floor(diffDays / 7) > 1 ? "S" : ""} AGO`;
  return `${Math.floor(diffDays / 30)} MONTH${Math.floor(diffDays / 30) > 1 ? "S" : ""} AGO`;
}
