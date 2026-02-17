import { fetchNewRSSItems } from "../services/rss";
import { generateBlogContent } from "../services/contentGeneratorCode";
import { optimizeForSEO } from "../services/seoOptimizerCode";
import { convertToHTML } from "../services/htmlConverterCode";
import { generateBlogTitle } from "../services/titleGeneratorCode";
import { generateMetaDescription } from "../services/metaDescriptionGeneratorCode";
import { generateImage } from "../services/imageGenerator";
import { uploadImageToRailbucket } from "../services/railbucket";
import { parseContentBlocks, generateSlug, generateExcerpt } from "../services/contentParser";
import { prisma } from "../lib/prisma";
import slugify from "slugify";

/**
 * Full pipeline using CODE-BASED generation (no OpenAI).
 * RSS → Code (Blog) → Code (SEO) → Code (HTML) → Code (Title) → Code (Meta) → Grok (Image) → Parse → Save
 */
export async function generateArticles(): Promise<void> {
  const maxArticles = parseInt(process.env.MAX_ARTICLES_PER_RUN || "3");

  // Step 1: Fetch new RSS items
  const newItems = await fetchNewRSSItems();

  if (newItems.length === 0) {
    console.log("[Pipeline] No new articles to process.");
    return;
  }

  // Process up to maxArticles per run
  const itemsToProcess = newItems.slice(0, maxArticles);
  console.log(`[Pipeline] Processing ${itemsToProcess.length} articles using CODE-BASED generation...`);

  for (const item of itemsToProcess) {
    try {
      console.log(`\n[Pipeline] --- Processing: ${item.title} ---`);

      // Step 2: Generate blog content with CODE (extracts from source article)
      const rawBlog = await generateBlogContent(item);

      // Step 3: SEO optimize with CODE
      const seoResult = await optimizeForSEO(rawBlog, item.categories);

      // Step 4: Convert to clean HTML with CODE
      const htmlContent = await convertToHTML(seoResult.optimizedContent);

      // Step 5: Generate title with CODE
      const blogTitle = await generateBlogTitle(htmlContent, item.title);

      // Step 6: Generate meta description with CODE
      const metaDescription = await generateMetaDescription(htmlContent);

      // Step 7: Parse HTML into content blocks
      const contentBlocks = parseContentBlocks(htmlContent);
      const slug = generateSlug(blogTitle);
      
      // Generate excerpt
      let excerpt = generateExcerpt(contentBlocks, metaDescription) || metaDescription.slice(0, 250);
      if (excerpt.length > 500) {
        excerpt = excerpt.slice(0, 497) + "...";
      }

      // Step 8: Get image - use RSS image first, then generate with Grok-2-Image
      let imageUrl = item.imageUrl || item.enclosure?.url || "";
      
      if (!imageUrl) {
        console.log("[Pipeline] No RSS image found, generating with Grok-2-Image...");
        try {
          imageUrl = await generateImage(blogTitle, seoResult.topics, metaDescription);
          console.log("[Pipeline] Image generated successfully with Grok-2-Image");
        } catch (imgError) {
          console.error("[Pipeline] Image generation failed, using placeholder:", imgError);
          imageUrl = "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80";
        }
      } else {
        console.log("[Pipeline] Using image from RSS feed, uploading to Railbucket...");
        try {
          const filename = `${slugify(blogTitle, { lower: true, strict: true })}-rss-${Date.now()}.png`;
          imageUrl = await uploadImageToRailbucket(imageUrl, filename);
          console.log("[Pipeline] RSS image uploaded to Railbucket");
        } catch (uploadError) {
          console.error("[Pipeline] Failed to upload RSS image to Railbucket, using original URL:", uploadError);
        }
      }

      // Step 9: Save to database
      const contentJson = contentBlocks.map((block) => ({
        type: block.type,
        text: block.text || null,
        src: block.src || null,
        alt: block.alt || null,
      }));

      const article = await prisma.article.create({
        data: {
          slug,
          title: blogTitle,
          excerpt,
          topics: seoResult.topics,
          author: "Appify",
          imageUrl,
          date: new Date(),
          isFeatured: false,
          metaTitle: seoResult.metaTitle.slice(0, 60),
          metaDescription: seoResult.metaDescription.slice(0, 160),
          sourceUrl: item.link,
          status: "published",
          content: contentJson as any,
        },
      });

      console.log(`[Pipeline] ✅ Article created: ${article.slug}`);
    } catch (error: any) {
      console.error(`[Pipeline] ❌ Failed to process "${item.title}":`, error.message);
      console.error(error.stack);
    }
  }

  console.log("\n[Pipeline] Article generation complete!");
}
