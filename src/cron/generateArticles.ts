import { fetchNewRSSItems } from "../services/rss";
import { generateBlogContent } from "../services/contentGenerator";
import { optimizeForSEO } from "../services/seoOptimizer";
import { parseContentBlocks, generateSlug, generateExcerpt } from "../services/contentParser";
import { prisma } from "../lib/prisma";

/**
 * Full pipeline: RSS → OpenAI → Claude → Parse → Save to DB
 * This replaces the entire Make.com automation flow.
 */
export async function generateArticles(): Promise<void> {
  const maxArticles = parseInt(process.env.MAX_ARTICLES_PER_RUN || "3");

  // Step 1: Fetch new RSS items
  const newItems = await fetchNewRSSItems();

  if (newItems.length === 0) {
    console.log("[Pipeline] No new articles to process.");
    return;
  }

  // Process up to maxArticles per run to control API costs
  const itemsToProcess = newItems.slice(0, maxArticles);
  console.log(`[Pipeline] Processing ${itemsToProcess.length} articles...`);

  for (const item of itemsToProcess) {
    try {
      console.log(`\n[Pipeline] --- Processing: ${item.title} ---`);

      // Step 2: Generate blog content with OpenAI
      const rawBlog = await generateBlogContent(item);

      // Step 3: SEO optimize with Claude
      const seoResult = await optimizeForSEO(rawBlog);

      // Step 4: Parse into content blocks
      const contentBlocks = parseContentBlocks(seoResult.optimizedContent);
      const slug = generateSlug(item.title);
      const excerpt = generateExcerpt(contentBlocks);

      // Step 5: Save to database
      const article = await prisma.article.create({
        data: {
          slug,
          title: item.title,
          excerpt: excerpt || item.contentSnippet || "",
          topics: seoResult.topics,
          author: "Appify",
          imageUrl: item.enclosure?.url || "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80",
          date: item.pubDate ? new Date(item.pubDate) : new Date(),
          isFeatured: false,
          metaTitle: seoResult.metaTitle,
          metaDescription: seoResult.metaDescription,
          sourceUrl: item.link,
          status: "pending_review",
          contentBlocks: {
            create: contentBlocks.map((block, index) => ({
              type: block.type,
              text: block.text,
              src: block.src,
              alt: block.alt,
              sortOrder: index,
            })),
          },
        },
      });

      console.log(`[Pipeline] Saved article: ${article.slug} (status: pending_review)`);
    } catch (error) {
      console.error(`[Pipeline] Failed to process "${item.title}":`, error);
      // Continue with next item
    }
  }

  console.log("\n[Pipeline] Generation run complete.");
}

// Allow running directly: pnpm generate
if (require.main === module) {
  generateArticles()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
