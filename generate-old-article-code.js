// Generate an old article using code-based generation
const { PrismaClient } = require("@prisma/client");
const { generateBlogContent } = require("./dist/services/contentGeneratorCode");
const { optimizeForSEO } = require("./dist/services/seoOptimizerCode");
const { convertToHTML } = require("./dist/services/htmlConverterCode");
const { generateBlogTitle } = require("./dist/services/titleGeneratorCode");
const { generateMetaDescription } = require("./dist/services/metaDescriptionGeneratorCode");
const { generateImage } = require("./dist/services/imageGenerator");
const { uploadImageToRailbucket } = require("./dist/services/railbucket");
const { parseContentBlocks, generateSlug, generateExcerpt } = require("./dist/services/contentParser");
const slugify = require("slugify");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://postgres:SutGuMkPQWYuWNudhUrpDWYWQgfUHYWZ@shortline.proxy.rlwy.net:53169/railway"
    }
  }
});

// Set code-based generation
process.env.USE_CODE_GENERATION = "true";

async function generateOldArticle() {
  console.log("🔍 Finding an old RSS article that hasn't been generated yet...\n");

  // Get a list of recent articles from a test RSS feed to find one we haven't processed
  const Parser = require("rss-parser");
  const parser = new Parser();
  
  // Try Wired or TechCrunch feed
  const feedUrl = "https://www.wired.com/feed/rss";
  
  try {
    console.log(`Fetching RSS feed: ${feedUrl}`);
    const feed = await parser.parseURL(feedUrl);
    console.log(`Found ${feed.items.length} items in feed\n`);

    // Check each item to find one we haven't processed
    for (const item of feed.items.slice(0, 10)) { // Check first 10 items
      if (!item.link) continue;

      const exists = await prisma.article.findUnique({
        where: { sourceUrl: item.link },
        select: { id: true, title: true },
      });

      if (!exists) {
        // Pre-filter: Check if article matches our allowed topics
        // Skip articles that clearly don't match (e.g., sports, politics, etc.)
        const itemContent = (item.contentSnippet || item.content || item.title || "").toLowerCase();
        
        // Check for non-tech topics that should be excluded
        const excludedTopics = [
          "figure skating", "skating", "olympics", "sports", "athlete", "athletic",
          "politics", "political", "election", "government", "senate", "congress",
          "weather", "climate", "hurricane", "tornado", "earthquake",
          "celebrity", "entertainment", "movie", "tv show", "music album"
        ];
        
        const hasExcludedTopic = excludedTopics.some(topic => itemContent.includes(topic));
        if (hasExcludedTopic) {
          console.log(`⚠️  Skipping article - contains excluded topic: ${item.title}`);
          continue; // Skip this article
        }
        
        // Check for tech-related topics
        const hasRelevantTopic = 
          itemContent.includes("ai") || itemContent.includes("artificial intelligence") ||
          itemContent.includes("automation") || itemContent.includes("web development") ||
          itemContent.includes("startup") || itemContent.includes("defi") ||
          itemContent.includes("web3") || itemContent.includes("blockchain") ||
          itemContent.includes("design") || itemContent.includes("culture") ||
          itemContent.includes("workplace") || itemContent.includes("technology") ||
          itemContent.includes("app development") || itemContent.includes("software") ||
          itemContent.includes("tech") || itemContent.includes("digital") ||
          itemContent.includes("computer") || itemContent.includes("internet") ||
          itemContent.includes("coding") || itemContent.includes("programming");
        
        // Check RSS categories if available
        const rssCategories = item.categories || [];
        const hasRelevantCategory = rssCategories.some((cat) => {
          const catLower = (cat || "").toLowerCase();
          return catLower.includes("tech") || catLower.includes("ai") || 
                 catLower.includes("automation") || catLower.includes("web") ||
                 catLower.includes("startup") || catLower.includes("design") ||
                 catLower.includes("business") || catLower.includes("science");
        });
        
        // Only generate if it has relevant tech topic AND doesn't have excluded topics
        if (!hasRelevantTopic && !hasRelevantCategory) {
          console.log(`⚠️  Skipping article - doesn't match our tech topics: ${item.title}`);
          continue; // Skip this article
        }
        
        console.log(`✅ Found unprocessed article: ${item.title}`);
        console.log(`   Link: ${item.link}\n`);

        // Extract image - check multiple sources
        let imageUrl = item.enclosure?.url || "";
        
        // Check content for images
        if (item.content) {
          const imgMatches = item.content.match(/<img[^>]+src="([^"]+)"[^>]*>/gi);
          if (imgMatches && imgMatches.length > 0) {
            // Get the first image URL
            const firstImg = imgMatches[0].match(/src="([^"]+)"/i);
            if (firstImg && firstImg[1]) {
              imageUrl = firstImg[1];
            }
          }
        }
        
        // Check contentSnippet
        if (!imageUrl && item.contentSnippet) {
          const imgMatch = item.contentSnippet.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
          if (imgMatch && imgMatch[1]) {
            imageUrl = imgMatch[1];
          }
        }
        
        // Check for media:content or itunes:image
        if (!imageUrl && item["media:content"]?.url) {
          imageUrl = item["media:content"].url;
        }
        if (!imageUrl && item["itunes:image"]?.href) {
          imageUrl = item["itunes:image"].href;
        }

        const rssItem = {
          title: item.title || "Untitled",
          link: item.link,
          contentSnippet: item.contentSnippet,
          content: item.content,
          pubDate: item.pubDate,
          categories: item.categories,
          imageUrl,
        };

        console.log("🚀 Generating article using CODE-BASED generation...\n");

        // Step 1: Generate blog content (this also extracts image from article page)
        console.log("Step 1: Generating blog content...");
        const rawBlog = await generateBlogContent(rssItem);
        console.log(`✅ Generated ${rawBlog.split(/\s+/).length} words\n`);
        
        // Check if image was extracted during content generation
        if (rssItem.imageUrl && !imageUrl) {
          imageUrl = rssItem.imageUrl;
          console.log(`✅ Image extracted from article page: ${imageUrl.substring(0, 80)}...\n`);
        }

        // Step 2: SEO optimization
        console.log("Step 2: SEO optimization...");
        const seoResult = await optimizeForSEO(rawBlog, rssItem.categories, rssItem.title);
        console.log(`✅ SEO optimized. Topic: ${seoResult.topics}\n`);

        // Step 3: Convert to HTML
        console.log("Step 3: Converting to HTML...");
        const htmlContent = await convertToHTML(seoResult.optimizedContent);
        console.log(`✅ HTML generated\n`);

        // Step 4: Generate title
        console.log("Step 4: Generating title...");
        const blogTitle = await generateBlogTitle(htmlContent, rssItem.title);
        console.log(`✅ Title: ${blogTitle}\n`);

        // Step 5: Generate meta description
        console.log("Step 5: Generating meta description...");
        const metaDescription = await generateMetaDescription(htmlContent);
        console.log(`✅ Meta Description generated\n`);

        // Step 6: Parse content blocks
        const contentBlocks = parseContentBlocks(htmlContent);
        const slug = generateSlug(blogTitle);
        let excerpt = generateExcerpt(contentBlocks, metaDescription) || metaDescription.slice(0, 250);
        if (excerpt.length > 500) {
          excerpt = excerpt.slice(0, 497) + "...";
        }

        // Step 7: Handle image - use RSS image or extracted image, upload to Railbucket
        if (imageUrl) {
          console.log("Step 7: Uploading image to Railbucket...");
          try {
            const filename = `${slugify(blogTitle, { lower: true, strict: true })}-${Date.now()}.png`;
            imageUrl = await uploadImageToRailbucket(imageUrl, filename);
            console.log("✅ Image uploaded to Railbucket\n");
          } catch (uploadError) {
            console.error("⚠️  Failed to upload image, using original URL:", uploadError.message);
            // Keep original URL if upload fails
          }
        } else {
          // No image found anywhere - use placeholder (code-based mode doesn't generate images)
          console.log("Step 7: No image found, using placeholder...");
          imageUrl = "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80";
          console.log("✅ Using placeholder image\n");
        }

        // Step 8: Save to database
        console.log("Step 7: Saving to database...");
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
            date: rssItem.pubDate ? new Date(rssItem.pubDate) : new Date(),
            isFeatured: false,
            metaTitle: seoResult.metaTitle.slice(0, 60),
            metaDescription: seoResult.metaDescription.slice(0, 160),
            sourceUrl: rssItem.link,
            status: "published",
            content: contentJson,
          },
        });

        console.log(`\n✅ Article created successfully!`);
        console.log(`   Slug: ${article.slug}`);
        console.log(`   Title: ${article.title}`);
        console.log(`   Topic: ${article.topics}`);
        console.log(`   Status: ${article.status}`);

        await prisma.$disconnect();
        return;
      }
    }

    console.log("❌ No unprocessed articles found in the first 10 items.");
    console.log("   Try a different RSS feed or check if all recent articles are already processed.");

  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

generateOldArticle();
