import { fetchNewRSSItems, fetchAllRSSItems } from "../services/rss";
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
import { validateArticleContent } from "../services/contentValidator";
import { prisma } from "../lib/prisma";
import slugify from "slugify";

/**
 * Generation Mode Selection:
 * 
 * DEFAULT: Code-based generation (no OpenAI required)
 * Set USE_OPENAI=true to use OpenAI generation (requires OPENAI_API_KEY)
 * 
 * Code version: Faster, no API costs, uses RSS content extraction (DEFAULT)
 * OpenAI version: Higher quality, more creative, requires API key (OPTIONAL)
 */
const USE_CODE_GENERATION = process.env.USE_OPENAI !== "true"; // Default to code-based, only use OpenAI if explicitly enabled

// Select functions based on environment variable
// Both versions are available - just switch the flag to toggle
const generateBlogContent = USE_CODE_GENERATION ? generateBlogContentCode : generateBlogContentOpenAI;
const optimizeForSEO = USE_CODE_GENERATION ? optimizeForSEOCode : optimizeForSEOOpenAI;
const convertToHTML = USE_CODE_GENERATION ? convertToHTMLCode : convertToHTMLOpenAI;
const generateBlogTitle = USE_CODE_GENERATION ? generateBlogTitleCode : generateBlogTitleOpenAI;
const generateMetaDescription = USE_CODE_GENERATION ? generateMetaDescriptionCode : generateMetaDescriptionOpenAI;

/**
 * Full pipeline: RSS → Code-based generation → SEO optimization → HTML conversion → Title/Description → Image → Parse → Save
 * This replaces the entire Make.com automation flow.
 * 
 * Uses code-based generation by default (no OpenAI required).
 * Set USE_OPENAI=true to use OpenAI generation instead (requires OPENAI_API_KEY).
 */
export async function generateArticles(): Promise<void> {
  const maxArticles = parseInt(process.env.MAX_ARTICLES_PER_RUN || "3");
  const fetchAll = process.env.FETCH_ALL_RSS === "true"; // Set to true to fetch all items, including previously processed ones

  // Step 1: Fetch RSS items (new only, or all if FETCH_ALL_RSS=true)
  const newItems = fetchAll 
    ? await fetchAllRSSItems(50) // Fetch up to 50 items from all feeds
    : await fetchNewRSSItems();

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
      
      // Check if article already exists (when using fetchAllRSSItems, we still want to skip existing ones)
      const existingArticle = await prisma.article.findUnique({
        where: { sourceUrl: item.link },
        select: { id: true, slug: true },
      });
      
      if (existingArticle) {
        console.log(`[Pipeline] ⚠️  Article already exists: ${existingArticle.slug}. Skipping.`);
        continue;
      }
      
      // Pre-filter: Check if article aligns with our core topics for long-term SEO authority
      // Core topics: AI software, Digital transformation, App development, Workforce automation, Emerging technology strategy
      const itemContent = (item.contentSnippet || item.content || item.title || "").toLowerCase();
      
      // Strong alignment indicators for our core topics
      const hasStrongAlignment = 
        // AI software (including AI agents, AI tools, machine learning, AI industry, OpenAI)
        (itemContent.includes("ai software") || itemContent.includes("artificial intelligence software") ||
         itemContent.includes("machine learning software") || itemContent.includes("ai platform") ||
         itemContent.includes("ai agent") || itemContent.includes("ai tool") || itemContent.includes("ai system") ||
         itemContent.includes("ai industry") || itemContent.includes("ai startup") ||
         itemContent.includes("openai") || (itemContent.includes("open") && itemContent.includes("ai")) ||
         (itemContent.includes("artificial intelligence") && (itemContent.includes("software") || itemContent.includes("development") || itemContent.includes("business") || itemContent.includes("industry")))) ||
        // Digital transformation
        (itemContent.includes("digital transformation") || itemContent.includes("digital strategy") ||
         itemContent.includes("digital innovation") || itemContent.includes("digital adoption")) ||
        // App development
        (itemContent.includes("app development") || itemContent.includes("mobile app") ||
         itemContent.includes("software development") || itemContent.includes("application development") ||
         itemContent.includes("app developer") || itemContent.includes("mobile development")) ||
        // Workforce automation
        (itemContent.includes("workforce automation") || itemContent.includes("workplace automation") ||
         itemContent.includes("business automation") || itemContent.includes("process automation") ||
         (itemContent.includes("automation") && (itemContent.includes("work") || itemContent.includes("business") || itemContent.includes("workplace"))) ||
         (itemContent.includes("replacing workers") && itemContent.includes("ai")) ||
         (itemContent.includes("workers") && itemContent.includes("ai") && (itemContent.includes("replace") || itemContent.includes("automation")))) ||
        // Emerging technology strategy
        (itemContent.includes("emerging technology") || itemContent.includes("tech strategy") ||
         itemContent.includes("technology adoption") || itemContent.includes("innovation strategy") ||
         itemContent.includes("technology strategy")) ||
        // Startup/accelerator with tech focus (for articles like "AI Industry Rivals Are Teaming Up on a Startup Accelerator")
        ((itemContent.includes("startup") || itemContent.includes("accelerator")) && 
         (itemContent.includes("ai") || itemContent.includes("tech") || itemContent.includes("software") || itemContent.includes("digital")));
      
      // Secondary indicators (weaker but still relevant)
      const hasSecondaryAlignment = 
        itemContent.includes("ai") || itemContent.includes("automation") ||
        itemContent.includes("software") || itemContent.includes("digital") ||
        itemContent.includes("app") || itemContent.includes("technology");
      
      // Check RSS categories if available
      const rssCategories = item.categories || [];
      const hasRelevantCategory = rssCategories.some((cat: string) => {
        const catLower = cat.toLowerCase();
        return catLower.includes("ai") || catLower.includes("software") || 
               catLower.includes("automation") || catLower.includes("digital") ||
               catLower.includes("technology") || catLower.includes("development");
      });
      
      // Check if title contains strong keywords (for articles where title is more descriptive than content)
      const titleLower = (item.title || "").toLowerCase();
      const titleHasStrongKeyword = titleLower.includes("ai agent") || 
                                    titleLower.includes("ai software") ||
                                    titleLower.includes("openai") ||
                                    titleLower.includes("app development") ||
                                    titleLower.includes("digital transformation") ||
                                    (titleLower.includes("ai") && (titleLower.includes("tool") || titleLower.includes("platform") || titleLower.includes("system")));
      
      // Only proceed if there's STRONG alignment with core topics (in content or title)
      // Require explicit strong alignment - no secondary indicators or weak matches
      if (!hasStrongAlignment && !titleHasStrongKeyword) {
        console.log(`[Pipeline] ⚠️  Skipping article - doesn't align with core topics (AI software, Digital transformation, App development, Workforce automation, Emerging technology strategy): ${item.title}`);
        continue; // Skip this article
      }

      // Step 2: Generate blog content (OpenAI or Code)
      const rawBlog = await generateBlogContent(item);

      // Step 3: SEO optimize (OpenAI or Code)
      const seoResult = USE_CODE_GENERATION 
        ? await optimizeForSEO(rawBlog, item.categories, item.title)
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
      
      // Step 7.5: Strict quality validation before publishing
      // Use primary keyword from SEO result (already identified by optimizer)
      const primaryKeyword = seoResult.primaryKeyword;
      
      const validation = validateArticleContent(
        seoResult.optimizedContent,
        contentBlocks,
        primaryKeyword
      );

      if (!validation.isValid) {
        console.error(`[Pipeline] ❌ Article validation failed for: ${item.title}`);
        console.error(`[Pipeline] Validation errors:`);
        validation.errors.forEach((error) => console.error(`  - ${error}`));
        if (validation.warnings.length > 0) {
          console.warn(`[Pipeline] Validation warnings:`);
          validation.warnings.forEach((warning) => console.warn(`  - ${warning}`));
        }
        console.log(`[Pipeline] ⚠️  Skipping article due to quality validation failures`);
        continue; // Skip this article - don't publish
      }

      if (validation.warnings.length > 0) {
        console.warn(`[Pipeline] ⚠️  Validation warnings for: ${item.title}`);
        validation.warnings.forEach((warning) => console.warn(`  - ${warning}`));
      } else {
        console.log(`[Pipeline] ✅ Article passed all quality validations`);
      }
      
      // Generate excerpt (limit to reasonable length for database)
      let excerpt = generateExcerpt(contentBlocks, metaDescription) || metaDescription.slice(0, 250);
      // Ensure excerpt doesn't exceed database limits (typically 500-1000 chars, but be safe with 500)
      if (excerpt.length > 500) {
        excerpt = excerpt.slice(0, 497) + "...";
      }

      // Step 8: Get image - use RSS image first, then try to extract from article page, then generate with Grok-2-Image (OpenAI mode only)
      // All images are uploaded to Railbucket for consistent storage
      let imageUrl = item.imageUrl || item.enclosure?.url || "";
      
      // If no RSS image and using code-based generation, try to extract from article page
      if (!imageUrl && USE_CODE_GENERATION) {
        console.log("[Pipeline] No RSS image found, checking if image was extracted from article page...");
        // The generateBlogContent function should have set item.imageUrl if it found an image
        // This happens in contentGeneratorCode.ts when fetchArticleContent extracts og:image
        if (item.imageUrl) {
          imageUrl = item.imageUrl;
          console.log("[Pipeline] Found image from article page extraction");
        }
      }
      
      if (imageUrl) {
        // Image available - upload to Railbucket (both modes)
        console.log("[Pipeline] Using image, uploading to Railbucket...");
        try {
          const filename = `${slugify(blogTitle, { lower: true, strict: true })}-${Date.now()}.png`;
          imageUrl = await uploadImageToRailbucket(imageUrl, filename);
          console.log("[Pipeline] Image uploaded to Railbucket");
        } catch (uploadError) {
          console.error("[Pipeline] Failed to upload image to Railbucket, using original URL:", uploadError);
          // Keep original URL if upload fails
        }
      } else {
        // No image found anywhere - generate with Grok (OpenAI mode) or use placeholder (Code mode)
        if (USE_CODE_GENERATION) {
          console.log("[Pipeline] No image found anywhere, using placeholder (code-based mode)");
          imageUrl = "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80";
        } else {
          console.log("[Pipeline] No image found, generating with Grok-2-Image...");
          try {
            imageUrl = await generateImage(blogTitle, seoResult.topics);
            console.log("[Pipeline] Image generated successfully with Grok-2-Image");
          } catch (imgError) {
            console.error("[Pipeline] Image generation failed, using placeholder:", imgError);
            imageUrl = "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80";
          }
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
