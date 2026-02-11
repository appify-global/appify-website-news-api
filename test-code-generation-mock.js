// Test code-based generation with a mock RSS item
const { PrismaClient } = require("@prisma/client");
const { generateBlogContent } = require("./dist/services/contentGeneratorCode");
const { optimizeForSEO } = require("./dist/services/seoOptimizerCode");
const { convertToHTML } = require("./dist/services/htmlConverterCode");
const { generateBlogTitle } = require("./dist/services/titleGeneratorCode");
const { generateMetaDescription } = require("./dist/services/metaDescriptionGeneratorCode");
const { parseContentBlocks } = require("./dist/services/contentParser");

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://postgres:SutGuMkPQWYuWNudhUrpDWYWQgfUHYWZ@shortline.proxy.rlwy.net:53169/railway"
    }
  }
});

// Mock RSS item for testing
const mockRSSItem = {
  title: "OpenAI Releases New GPT-5 Model with Enhanced Capabilities",
  link: "https://example.com/test-article-" + Date.now(), // Unique URL
  contentSnippet: "OpenAI has announced the release of GPT-5, featuring improved reasoning capabilities and better performance on complex tasks. The new model represents a significant advancement in artificial intelligence technology.",
  content: "OpenAI has announced the release of GPT-5, featuring improved reasoning capabilities and better performance on complex tasks. The new model represents a significant advancement in artificial intelligence technology. This development has implications for app developers and businesses looking to integrate AI into their products.",
  pubDate: new Date().toISOString(),
  categories: ["AI", "Technology"],
  imageUrl: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80",
};

async function testCodeGeneration() {
  console.log("🧪 Testing CODE-BASED generation with mock RSS item...\n");
  console.log("Mock RSS Item:");
  console.log(`  Title: ${mockRSSItem.title}`);
  console.log(`  Link: ${mockRSSItem.link}`);
  console.log("");

  try {
    // Step 1: Generate blog content
    console.log("Step 1: Generating blog content...");
    const rawBlog = await generateBlogContent(mockRSSItem);
    console.log(`✅ Generated ${rawBlog.split(/\s+/).length} words\n`);

    // Step 2: SEO optimization
    console.log("Step 2: SEO optimization...");
    const seoResult = await optimizeForSEO(rawBlog, mockRSSItem.categories, mockRSSItem.title);
    console.log(`✅ SEO optimized. Topic: ${seoResult.topics}`);
    console.log(`   Meta Title: ${seoResult.metaTitle}`);
    console.log(`   Meta Description: ${seoResult.metaDescription}\n`);

    // Step 3: Convert to HTML
    console.log("Step 3: Converting to HTML...");
    const htmlContent = await convertToHTML(seoResult.optimizedContent);
    console.log(`✅ HTML generated (${htmlContent.length} chars)\n`);

    // Step 4: Generate title
    console.log("Step 4: Generating title...");
    const blogTitle = await generateBlogTitle(htmlContent, mockRSSItem.title);
    console.log(`✅ Title: ${blogTitle}\n`);

    // Step 5: Generate meta description
    console.log("Step 5: Generating meta description...");
    const metaDescription = await generateMetaDescription(htmlContent);
    console.log(`✅ Meta Description: ${metaDescription}\n`);

    // Step 6: Parse content blocks
    console.log("Step 6: Parsing content blocks...");
    const contentBlocks = parseContentBlocks(htmlContent);
    console.log(`✅ Parsed ${contentBlocks.length} content blocks`);
    console.log(`   Block types: ${contentBlocks.map(b => b.type).join(", ")}\n`);

    // Summary
    console.log("📊 Summary:");
    console.log(`   Title: ${blogTitle}`);
    console.log(`   Topic: ${seoResult.topics}`);
    console.log(`   Content Blocks: ${contentBlocks.length}`);
    console.log(`   Meta Title: ${seoResult.metaTitle}`);
    console.log(`   Meta Description: ${metaDescription.substring(0, 80)}...`);
    console.log("");

    console.log("✅ Code-based generation test PASSED!");
    console.log("\n📝 Sample HTML output (first 500 chars):");
    console.log(htmlContent.substring(0, 500) + "...");

  } catch (error) {
    console.error("❌ Test failed:", error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testCodeGeneration();
