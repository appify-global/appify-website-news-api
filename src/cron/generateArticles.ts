import { fetchNewRSSItems } from "../services/rss";
import { generateBlogContent } from "../services/contentGenerator";
import { optimizeForSEO } from "../services/seoOptimizer";
import { convertToHTML } from "../services/htmlConverter";
import { generateBlogTitle } from "../services/titleGenerator";
import { generateMetaDescription } from "../services/metaDescriptionGenerator";
import { generateImage } from "../services/imageGenerator";
import { parseContentBlocks, generateSlug, generateExcerpt } from "../services/contentParser";
import { prisma } from "../lib/prisma";

/**
 * Full pipeline: RSS → OpenAI (Blog) → OpenAI (SEO) → OpenAI (HTML) → OpenAI (Title) → OpenAI (Meta) → Grok (Image) → Parse → Save
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

      // Step 3: SEO optimize with OpenAI
      const seoResult = await optimizeForSEO(rawBlog);

      // Step 4: Convert to clean HTML with OpenAI
      const htmlContent = await convertToHTML(seoResult.optimizedContent);

      // Step 5: Generate title with OpenAI
      const blogTitle = await generateBlogTitle(htmlContent);

      // Step 6: Generate meta description with OpenAI
      const metaDescription = await generateMetaDescription(htmlContent);

      // Step 7: Parse HTML into content blocks
      const contentBlocks = parseContentBlocks(htmlContent);
      const slug = generateSlug(blogTitle); // Use generated title for slug
      const excerpt = generateExcerpt(contentBlocks) || metaDescription.slice(0, 200);

      // Step 8: Generate image with Grok (or use RSS image)
      let imageUrl = item.enclosure?.url || "";
      if (!imageUrl) {
        try {
          imageUrl = await generateImage(blogTitle, seoResult.topics);
        } catch (imgError) {
          console.error("[Pipeline] Image generation failed, using placeholder:", imgError);
          imageUrl = "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80";
        }
      }

      // Step 9: Save to database
      const article = await prisma.article.create({
        data: {
          slug,
          title: blogTitle, // Use generated title instead of RSS title
          excerpt,
          topics: seoResult.topics,
          author: "Appify",
          imageUrl,
          date: item.pubDate ? new Date(item.pubDate) : new Date(),
          isFeatured: false,
          metaTitle: seoResult.metaTitle || blogTitle.slice(0, 60), // Fallback to title if needed
          metaDescription: metaDescription,
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
