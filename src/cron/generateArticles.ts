import { fetchNewRSSItems, fetchAllRSSItems, RSSItem } from "../services/rss";
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
import OpenAI from "openai";

/**
 * Generation Mode Selection:
 * 
 * DEFAULT: OpenAI generation (requires OPENAI_API_KEY)
 * Set USE_CODE_GENERATION=true to use code-based generation (no OpenAI required)
 * 
 * OpenAI version: Higher quality, more creative, requires API key (DEFAULT)
 * Code version: Faster, no API costs, uses RSS content extraction (OPTIONAL)
 */
const USE_CODE_GENERATION = process.env.USE_CODE_GENERATION === "true"; // Default to OpenAI, only use code-based if explicitly enabled
const USE_AI_FILTER = process.env.USE_AI_FILTER === "true"; // Default to false - use code-based filtering to avoid rate limits. Set to "true" to enable AI filtering.

// Select functions based on environment variable
// Both versions are available - just switch the flag to toggle
const generateBlogContent = USE_CODE_GENERATION ? generateBlogContentCode : generateBlogContentOpenAI;
const optimizeForSEO = USE_CODE_GENERATION ? optimizeForSEOCode : optimizeForSEOOpenAI;
const convertToHTML = USE_CODE_GENERATION ? convertToHTMLCode : convertToHTMLOpenAI;
const generateBlogTitle = USE_CODE_GENERATION ? generateBlogTitleCode : generateBlogTitleOpenAI;
const generateMetaDescription = USE_CODE_GENERATION ? generateMetaDescriptionCode : generateMetaDescriptionOpenAI;

// Helper function to retry API calls with exponential backoff for rate limits
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isRateLimit = error?.status === 429 || error?.message?.includes("429") || error?.message?.includes("rate limit");
      
      if (isRateLimit && attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff: 1s, 2s, 4s
        console.log(`[Retry] Rate limit hit, waiting ${delay}ms before retry ${attempt + 2}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error; // Re-throw if not rate limit or out of retries
    }
  }
  throw new Error("Max retries exceeded");
}

// Helper function for AI-based semantic article filtering
async function checkArticleRelevanceWithAI(item: RSSItem): Promise<boolean> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[Filter] OpenAI API key not set, falling back to code-based filtering");
    return false; // Will fall back to code-based filter
  }

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const articleText = `${item.title}\n\n${item.contentSnippet || item.content || ""}`.slice(0, 2000); // Limit to 2000 chars for cost efficiency
    
    const response = await retryWithBackoff(async () => {
      return await openai.chat.completions.create({
        model: "gpt-4o-mini", // Use mini for cost efficiency
        temperature: 0,
        max_tokens: 10,
        messages: [
          {
            role: "system",
            content: `You are an article filter for a tech blog. Determine if an article is relevant to these topics:
- AI (artificial intelligence, machine learning, AI software, AI agents, AI tools)
- Web (web development, websites, web applications)
- Startups (startups, accelerators, venture capital, entrepreneurship)
- Web3 (blockchain, cryptocurrency, DeFi, NFTs)
- Work (workforce, workplace, productivity, remote work)
- Design (UX, UI, user experience, user interface design)
- Culture (workplace culture, company culture)
- Automation (workflow automation, business automation, process automation)
- Digital transformation
- App development (mobile apps, software development)

Respond with ONLY "YES" if the article is relevant to any of these topics, or "NO" if it's not relevant.`,
          },
          {
            role: "user",
            content: `Article title: "${item.title}"\n\nArticle content: "${articleText}"\n\nIs this article relevant to any of the topics listed?`,
          },
        ],
      });
    });

    const answer = response.choices[0]?.message?.content?.trim().toUpperCase();
    const isRelevant = answer === "YES";
    
    console.log(`[Filter] AI filter result: ${isRelevant ? "✅ Relevant" : "❌ Not relevant"} - ${item.title.substring(0, 60)}...`);
    return isRelevant;
  } catch (error) {
    console.error(`[Filter] AI filter failed:`, error);
    return false; // Fall back to code-based filter on error
  }
}

// Helper functions for duplicate detection
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();
}

function calculateTitleSimilarity(title1: string, title2: string): number {
  const normalized1 = normalizeTitle(title1);
  const normalized2 = normalizeTitle(title2);
  
  if (normalized1 === normalized2) return 1.0;
  
  // Extract meaningful words (length > 3)
  const words1 = normalized1.split(' ').filter(w => w.length > 3);
  const words2 = normalized2.split(' ').filter(w => w.length > 3);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  // Count common words
  const commonWords = words1.filter(w => words2.includes(w));
  const similarity = commonWords.length / Math.max(words1.length, words2.length);
  
  return similarity;
}

async function checkSemanticSimilarity(title1: string, title2: string): Promise<boolean> {
  // Only use OpenAI if API key is available
  if (!process.env.OPENAI_API_KEY) {
    return false;
  }
  
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 10,
      messages: [
        {
          role: "system",
          content: "You are a duplicate article detector. Determine if two article titles refer to the same news story. Respond with only 'YES' or 'NO'.",
        },
        {
          role: "user",
          content: `Title 1: "${title1}"\nTitle 2: "${title2}"\n\nDo these titles refer to the same news story?`,
        },
      ],
    });
    
    const answer = response.choices[0]?.message?.content?.trim().toUpperCase();
    return answer === "YES";
  } catch (error) {
    console.error(`[Duplicate Check] OpenAI semantic check failed:`, error);
    return false; // Fail open - don't block if check fails
  }
}

/**
 * Full pipeline: RSS → Code-based generation → SEO optimization → HTML conversion → Title/Description → Image → Parse → Save
 * This replaces the entire Make.com automation flow.
 * 
 * Uses code-based generation by default (no OpenAI required).
 * Set USE_OPENAI=true to use OpenAI generation instead (requires OPENAI_API_KEY).
 */
export async function generateArticles(fetchAllOverride?: boolean): Promise<void> {
  const maxArticles = parseInt(process.env.MAX_ARTICLES_PER_RUN || "5");
  const fetchAll = fetchAllOverride !== undefined ? fetchAllOverride : (process.env.FETCH_ALL_RSS === "true"); // Allow override via parameter, fallback to env var

  // Step 1: Fetch RSS items (new only, or all if FETCH_ALL_RSS=true)
  const newItems = fetchAll 
    ? await fetchAllRSSItems(50) // Fetch up to 50 items from all feeds
    : await fetchNewRSSItems();

  if (newItems.length === 0) {
    console.log("[Pipeline] No new articles to process.");
    return;
  }

  // Process articles until we generate at least 1 article (or up to maxArticles)
  // This ensures we don't stop early if articles are rejected by the filter
  const generationType = USE_CODE_GENERATION ? "CODE-BASED" : "OpenAI";
  const minArticlesToGenerate = 1; // Always try to generate at least 1 article
  console.log(`[Pipeline] Processing articles using ${generationType}... (will generate at least ${minArticlesToGenerate} article, up to ${maxArticles} articles)`);
  
  let articlesGenerated = 0;
  let articlesProcessed = 0;
  // Process all items if needed to find at least 1 article, but cap at reasonable limit
  const maxProcessAttempts = Math.max(newItems.length, maxArticles * 20); // Process all items or up to 20x maxArticles
  
  // Add delay between articles to avoid rate limits (especially for AI filter)
  const delayBetweenArticles = USE_AI_FILTER ? 2000 : 300; // 2s delay if using AI filter, 300ms otherwise

  for (const item of newItems) {
    // Add delay between articles to avoid hitting rate limits
    if (articlesProcessed > 0) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenArticles));
    }
    
    // Stop if we've generated enough articles (maxArticles)
    if (articlesGenerated >= maxArticles) {
      console.log(`[Pipeline] Generated ${articlesGenerated} articles, stopping.`);
      break;
    }
    
    // Stop if we've processed all items and generated at least the minimum
    if (articlesProcessed >= newItems.length && articlesGenerated >= minArticlesToGenerate) {
      console.log(`[Pipeline] Processed all ${articlesProcessed} articles. Generated ${articlesGenerated} article(s).`);
      break;
    }
    
    // Stop if we've processed too many without success (avoid infinite loops)
    // But only if we've already generated at least 1 article
    if (articlesProcessed >= maxProcessAttempts) {
      if (articlesGenerated >= minArticlesToGenerate) {
        console.log(`[Pipeline] Processed ${articlesProcessed} articles, reached limit. Generated ${articlesGenerated} articles.`);
        break;
      } else {
        console.log(`[Pipeline] Processed ${articlesProcessed} articles but haven't generated any yet. Continuing...`);
        // Don't break - keep trying if we haven't generated any articles yet
      }
    }
    
    articlesProcessed++;
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
      
      // Pre-filter: Check if article aligns with our core topics
      // Option 1: Use AI for semantic understanding (default, more flexible)
      // Option 2: Use code-based keyword matching (fallback if AI fails or disabled)
      let hasAlignment = false;
      
      if (USE_AI_FILTER && process.env.OPENAI_API_KEY) {
        // Use AI for semantic filtering - understands context better
        hasAlignment = await checkArticleRelevanceWithAI(item);
        
        // If AI says no, still check code-based as fallback (in case AI is too strict)
        if (!hasAlignment) {
          console.log(`[Filter] AI filter rejected, checking code-based filter as fallback...`);
        }
      }
      
      // Code-based keyword matching (used if AI filter disabled, failed, or as fallback)
      if (!hasAlignment) {
        const itemContent = (item.contentSnippet || item.content || item.title || "").toLowerCase();
        
        // Strong alignment indicators for our core topics
        const hasStrongAlignment = 
        // AI software (including AI agents, AI tools, machine learning, AI industry, OpenAI)
        (itemContent.includes("ai software") || itemContent.includes("artificial intelligence software") ||
         itemContent.includes("machine learning software") || itemContent.includes("ai platform") ||
         itemContent.includes("ai agent") || (itemContent.includes("ai") && itemContent.includes("agent")) || // Match "ai agent", "ai autonomous agent", "ai coding agent", etc.
         itemContent.includes("agentic ai") || itemContent.includes("agentic artificial intelligence") ||
         itemContent.includes("ai tool") || itemContent.includes("ai system") ||
         itemContent.includes("ai industry") || itemContent.includes("ai startup") || itemContent.includes("ai companies") || itemContent.includes("ai company") ||
         itemContent.includes("openai") || (itemContent.includes("open") && itemContent.includes("ai")) ||
         (itemContent.includes("artificial intelligence") && (itemContent.includes("software") || itemContent.includes("development") || itemContent.includes("business") || itemContent.includes("industry") || itemContent.includes("companies") || itemContent.includes("company")))) ||
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
      const titleHasStrongKeyword = titleLower.includes("ai agent") || (titleLower.includes("ai") && titleLower.includes("agent")) || // Match "ai agent", "ai autonomous agent", "ai coding agent", etc.
                                    titleLower.includes("agentic ai") ||
                                    titleLower.includes("ai software") ||
                                    titleLower.includes("ai companies") || titleLower.includes("ai company") ||
                                    titleLower.includes("openai") ||
                                    titleLower.includes("app development") ||
                                    titleLower.includes("digital transformation") ||
                                    (titleLower.includes("ai") && (titleLower.includes("tool") || titleLower.includes("platform") || titleLower.includes("system") || titleLower.includes("deploy") || titleLower.includes("expand") || titleLower.includes("coding") || titleLower.includes("development")));
      
      // Check if article aligns with any of our allowed topics (AI, Web, Startups, Web3, Work, Design, Culture, Automation)
      // Topics can appear in title OR content
      const titleHasAI = titleLower.includes("ai") || titleLower.includes("artificial intelligence");
      const contentHasAI = itemContent.includes("ai") || itemContent.includes("artificial intelligence") || itemContent.includes("machine learning");
      
      // Check for other topics in title or content
      const hasWebTopic = titleLower.includes("web") || itemContent.includes("web") || itemContent.includes("website") || itemContent.includes("web development");
      const hasStartupTopic = titleLower.includes("startup") || itemContent.includes("startup") || itemContent.includes("accelerator") || itemContent.includes("venture capital");
      const hasWeb3Topic = titleLower.includes("web3") || titleLower.includes("blockchain") || titleLower.includes("crypto") || itemContent.includes("web3") || itemContent.includes("blockchain") || itemContent.includes("defi");
      const hasWorkTopic = titleLower.includes("work") || itemContent.includes("workforce") || itemContent.includes("workplace") || itemContent.includes("automation");
      const hasDesignTopic = titleLower.includes("design") || titleLower.includes("ux") || titleLower.includes("ui") || itemContent.includes("design") || itemContent.includes("user experience");
      const hasCultureTopic = titleLower.includes("culture") || itemContent.includes("culture") || itemContent.includes("workplace culture");
      const hasAutomationTopic = titleLower.includes("automation") || itemContent.includes("automation") || itemContent.includes("automate");
      
      // Accept if article aligns with ANY of our topics (in title or content)
      const hasTopicAlignment = titleHasAI || contentHasAI || hasWebTopic || hasStartupTopic || hasWeb3Topic || 
                                hasWorkTopic || hasDesignTopic || hasCultureTopic || hasAutomationTopic;
      
      // Improved filtering: More lenient to catch relevant articles
      // Check for tech keywords in title/content for better matching
      const titleHasTechKeywords = titleLower.includes("tech") || titleLower.includes("software") || 
                                   titleLower.includes("digital") || titleLower.includes("innovation") ||
                                   titleLower.includes("platform") || titleLower.includes("system") ||
                                   titleLower.includes("development") || titleLower.includes("startup");
      
      const contentHasTechContext = (itemContent.includes("tech") || itemContent.includes("software") || 
                                     itemContent.includes("digital") || itemContent.includes("innovation") ||
                                     itemContent.includes("development") || itemContent.includes("startup")) &&
                                    itemContent.split(/\s+/).length > 30; // Has some substance
      
      // Proceed if there's alignment with core topics (strong alignment, title keywords, or any topic alignment)
      // Accept articles with: strong alignment, strong title keywords, OR alignment with any allowed topic
      // Improved: Also accept AI/tech combinations and tech keywords with context
      hasAlignment = hasStrongAlignment || 
                     titleHasStrongKeyword || 
                     hasTopicAlignment || // If article aligns with any of our topics, accept it
                     (hasSecondaryAlignment && hasRelevantCategory) ||
                     (hasSecondaryAlignment && itemContent.split(/\s+/).length > 50) || // If content is substantial and has secondary alignment
                     (titleHasAI && titleHasTechKeywords) || // AI + tech in title
                     (contentHasAI && contentHasTechContext) || // AI + tech context in content
                     (titleHasTechKeywords && (titleHasAI || contentHasAI)); // Tech keywords + AI mention
      }
      
      if (!hasAlignment) {
        console.log(`[Pipeline] ⚠️  Skipping article - doesn't align with core topics: ${item.title}`);
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

      // Step 5: Generate title (OpenAI or Code) - pass original RSS title for minimal modifications
      const blogTitle = USE_CODE_GENERATION
        ? await generateBlogTitle(htmlContent, item.title)
        : await generateBlogTitle(htmlContent, item.title); // Pass original title for minimal SEO tweaks

      // Step 6: Generate meta description (OpenAI or Code)
      const metaDescription = await generateMetaDescription(htmlContent);

      // Step 7: Parse HTML into content blocks
      const contentBlocks = parseContentBlocks(htmlContent);
      const slug = generateSlug(blogTitle); // Use generated title for slug
      
      // Duplicate Detection: Step 1 - Check if slug already exists
      const existingBySlug = await prisma.article.findUnique({
        where: { slug },
        select: { id: true, title: true, sourceUrl: true },
      });
      
      if (existingBySlug) {
        console.log(`[Pipeline] ⚠️  Duplicate detected: Article with same slug already exists: "${existingBySlug.title}" (from ${existingBySlug.sourceUrl}). Skipping: "${blogTitle}"`);
        continue;
      }
      
      // Duplicate Detection: Step 2 - Check normalized title similarity for recent articles (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const recentArticles = await prisma.article.findMany({
        where: {
          createdAt: { gte: sevenDaysAgo },
          status: 'published',
        },
        select: { id: true, title: true, slug: true, sourceUrl: true },
      });
      
      // Check for high title similarity (80%+)
      let potentialDuplicate: { title: string; sourceUrl: string | null } | null = null;
      for (const article of recentArticles) {
        const similarity = calculateTitleSimilarity(blogTitle, article.title);
        if (similarity >= 0.8) {
          potentialDuplicate = { title: article.title, sourceUrl: article.sourceUrl };
          break;
        }
      }
      
      // Duplicate Detection: Step 3 - If ambiguous, use OpenAI for semantic check
      if (potentialDuplicate) {
        console.log(`[Pipeline] 🔍 Potential duplicate detected (${Math.round(calculateTitleSimilarity(blogTitle, potentialDuplicate.title) * 100)}% title similarity). Checking with AI...`);
        
        const isSemanticDuplicate = await checkSemanticSimilarity(blogTitle, potentialDuplicate.title);
        
        if (isSemanticDuplicate) {
          console.log(`[Pipeline] ⚠️  Duplicate confirmed by AI: Similar article exists "${potentialDuplicate.title}" (from ${potentialDuplicate.sourceUrl}). Skipping: "${blogTitle}"`);
          continue;
        } else {
          console.log(`[Pipeline] ✅ AI confirmed: Different stories. Proceeding with article.`);
        }
      }
      
      // Generate excerpt (limit to reasonable length for database)
      let excerpt = generateExcerpt(contentBlocks, metaDescription) || metaDescription.slice(0, 250);
      // Ensure excerpt doesn't exceed database limits (typically 500-1000 chars, but be safe with 500)
      if (excerpt.length > 500) {
        excerpt = excerpt.slice(0, 497) + "...";
      }

      // Step 8: Get image - use RSS image first, try to upload it, only use Grok if RSS image fails
      // All images are uploaded to Railbucket for consistent storage
      // Note: For code-based generation, generateBlogContent may have already extracted imageUrl from article page
      // Check imageUrl again after content generation (it may have been set during generateBlogContent)
      let imageUrl = item.imageUrl || item.enclosure?.url || "";
      
      if (imageUrl) {
        console.log(`[Pipeline] Image found: ${imageUrl.substring(0, 80)}... (from ${item.imageUrl ? 'article page/RSS' : 'RSS enclosure'})`);
      } else {
        console.log("[Pipeline] No RSS image found in feed or article page - will use Grok or placeholder");
      }
      
      if (imageUrl) {
        // Try to use RSS image - upload to Railbucket
        console.log("[Pipeline] RSS image found, attempting to upload to Railbucket...");
        try {
          const filename = `${slugify(blogTitle, { lower: true, strict: true })}-${Date.now()}.png`;
          imageUrl = await uploadImageToRailbucket(imageUrl, filename);
          console.log("[Pipeline] RSS image uploaded to Railbucket successfully");
        } catch (uploadError) {
          // RSS image URL failed (can't download/access) - fall back to Grok generation
          console.error("[Pipeline] RSS image URL failed or couldn't be accessed, generating with Grok-2-Image instead:", uploadError);
          try {
            imageUrl = await generateImage(blogTitle, seoResult.topics);
            console.log("[Pipeline] Image generated successfully with Grok-2-Image");
          } catch (imgError) {
            console.error("[Pipeline] Grok image generation also failed, using placeholder:", imgError);
            imageUrl = "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80";
          }
        }
      } else {
        // No RSS image found - generate with Grok (both modes) or use placeholder
        console.log("[Pipeline] No RSS image found, generating with Grok-2-Image...");
        try {
          imageUrl = await generateImage(blogTitle, seoResult.topics);
          console.log("[Pipeline] Image generated successfully with Grok-2-Image");
        } catch (imgError) {
          console.error("[Pipeline] Image generation failed, using placeholder:", imgError);
          imageUrl = "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80";
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

      // Log final image URL being saved
      const imageSource = imageUrl.includes('railbucket') ? 'Railbucket (from article/RSS)' : 
                         imageUrl.includes('grok') ? 'Grok-generated' : 
                         imageUrl.includes('unsplash') ? 'Placeholder' : 'Unknown';
      console.log(`[Pipeline] ✅ Saved article: ${article.slug} (status: published)`);
      console.log(`[Pipeline] 📸 Image URL saved: ${imageUrl.substring(0, 100)}... (source: ${imageSource})`);
      articlesGenerated++; // Increment counter when article is successfully generated
    } catch (error) {
      console.error(`[Pipeline] Failed to process "${item.title}":`, error);
      // Continue with next item
    }
  }

  console.log(`\n[Pipeline] Generation run complete. Processed ${articlesProcessed} articles, generated ${articlesGenerated} articles.`);
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
