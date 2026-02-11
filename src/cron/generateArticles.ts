import { fetchNewRSSItems } from "../services/rss";
import { generateBlogContent as generateBlogContentOpenAI } from "../services/contentGenerator";
import { optimizeForSEO as optimizeForSEOOpenAI } from "../services/seoOptimizer";
import { convertToHTML as convertToHTMLOpenAI } from "../services/htmlConverter";
import { generateBlogTitle as generateBlogTitleOpenAI } from "../services/titleGenerator";
import { generateMetaDescription as generateMetaDescriptionOpenAI } from "../services/metaDescriptionGenerator";
// Code-based alternatives
import { generateBlogContent as generateBlogContentCode } from "../services/contentGeneratorCode";
import { optimizeForSEO as optimizeForSEOCode } from "../services/seoOptimizerCode";
import { convertToHTML as convertToHTMLCode } from "../services/htmlConverterCode";
import { generateBlogTitle as generateBlogTitleCode } from "../services/titleGeneratorCode";
import { generateMetaDescription as generateMetaDescriptionCode } from "../services/metaDescriptionGeneratorCode";
import { generateImage } from "../services/imageGenerator";
import { uploadImageToRailbucket } from "../services/railbucket";
import { parseContentBlocks, generateSlug, generateExcerpt } from "../services/contentParser";
import { prisma } from "../lib/prisma";
import slugify from "slugify";

// Use code-based generation if USE_CODE_GENERATION=true, otherwise use OpenAI
const USE_CODE_GENERATION = process.env.USE_CODE_GENERATION === "true";

// Select functions based on environment variable
const generateBlogContent = USE_CODE_GENERATION ? generateBlogContentCode : generateBlogContentOpenAI;
const optimizeForSEO = USE_CODE_GENERATION ? optimizeForSEOCode : optimizeForSEOOpenAI;
const convertToHTML = USE_CODE_GENERATION ? convertToHTMLCode : convertToHTMLOpenAI;
const generateBlogTitle = USE_CODE_GENERATION ? generateBlogTitleCode : generateBlogTitleOpenAI;
const generateMetaDescription = USE_CODE_GENERATION ? generateMetaDescriptionCode : generateMetaDescriptionOpenAI;

/**
 * Full pipeline: RSS → (OpenAI or Code) → (OpenAI or Code) → (OpenAI or Code) → (OpenAI or Code) → (OpenAI or Code) → Grok (Image) → Parse → Save
 * This replaces the entire Make.com automation flow.
 * 
 * Set USE_CODE_GENERATION=true to use code-based generation instead of OpenAI.
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
  const generationType = USE_CODE_GENERATION ? "CODE-BASED" : "OpenAI";
  console.log(`[Pipeline] Processing ${itemsToProcess.length} articles using ${generationType}...`);

  for (const item of itemsToProcess) {
    try {
      console.log(`\n[Pipeline] --- Processing: ${item.title} ---`);

      // Step 2: Generate blog content (OpenAI or Code)
      const rawBlog = await generateBlogContent(item);

      // Step 3: SEO optimize (OpenAI or Code)
      const seoResult = USE_CODE_GENERATION 
        ? await optimizeForSEO(rawBlog, item.categories)
        : await optimizeForSEO(rawBlog);

      // Step 4: Convert to clean HTML (OpenAI or Code)
      const htmlContent = await convertToHTML(seoResult.optimizedContent);

      // Step 5: Generate title (OpenAI or Code)
      const blogTitle = USE_CODE_GENERATION
        ? await generateBlogTitle(htmlContent, item.title)
        : await generateBlogTitle(htmlContent);

      // Step 6: Generate meta description (OpenAI or Code)
      const metaDescription = await generateMetaDescription(htmlContent);

      // Step 7: Parse HTML into content blocks
      const contentBlocks = parseContentBlocks(htmlContent);
      const slug = generateSlug(blogTitle); // Use generated title for slug
      // Generate excerpt (limit to reasonable length for database)
      let excerpt = generateExcerpt(contentBlocks, metaDescription) || metaDescription.slice(0, 250);
      // Ensure excerpt doesn't exceed database limits (typically 500-1000 chars, but be safe with 500)
      if (excerpt.length > 500) {
        excerpt = excerpt.slice(0, 497) + "...";
      }

      // Step 8: Get image - use RSS image first, then generate with Grok-2-Image
      // All images are uploaded to Railbucket for consistent storage
      let imageUrl = item.imageUrl || item.enclosure?.url || "";
      
      if (!imageUrl) {
        console.log("[Pipeline] No RSS image found, generating with Grok-2-Image...");
        try {
          imageUrl = await generateImage(blogTitle, seoResult.topics);
          console.log("[Pipeline] Image generated successfully with Grok-2-Image");
        } catch (imgError) {
          console.error("[Pipeline] Image generation failed, using placeholder:", imgError);
          imageUrl = "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80";
        }
      } else {
        console.log("[Pipeline] Using image from RSS feed, uploading to Railbucket...");
        try {
          // Upload RSS image to Railbucket
          const filename = `${slugify(blogTitle, { lower: true, strict: true })}-rss-${Date.now()}.png`;
          imageUrl = await uploadImageToRailbucket(imageUrl, filename);
          console.log("[Pipeline] RSS image uploaded to Railbucket");
        } catch (uploadError) {
          console.error("[Pipeline] Failed to upload RSS image to Railbucket, using original URL:", uploadError);
          // Keep original URL if upload fails
        }
      }

      // Step 9: Save to database
      // Store content blocks as JSON array (much simpler than separate table)
      const contentJson = contentBlocks.map((block) => ({
        type: block.type,
        text: block.text || null,
        src: block.src || null,
        alt: block.alt || null,
      }));

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
          metaTitle: (seoResult.metaTitle || blogTitle.slice(0, 60)).slice(0, 60), // Max 60 chars
          metaDescription: metaDescription.slice(0, 160), // Max 160 chars
          sourceUrl: item.link,
          status: "published", // Auto-publish articles
          content: contentJson as any, // Store as JSON
        },
      });

      console.log(`[Pipeline] Saved article: ${article.slug} (status: published)`);
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
