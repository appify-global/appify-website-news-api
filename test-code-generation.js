const { generateArticles } = require("./dist/cron/generateArticles");

// Set environment variable for code-based generation
process.env.USE_CODE_GENERATION = "true";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:SutGuMkPQWYuWNudhUrpDWYWQgfUHYWZ@shortline.proxy.rlwy.net:53169/railway";
process.env.MAX_ARTICLES_PER_RUN = "1"; // Test with just 1 article

console.log("🧪 Testing CODE-BASED article generation...\n");
console.log("Environment:");
console.log(`  USE_CODE_GENERATION: ${process.env.USE_CODE_GENERATION}`);
console.log(`  MAX_ARTICLES_PER_RUN: ${process.env.MAX_ARTICLES_PER_RUN}`);
console.log("");

generateArticles()
  .then(() => {
    console.log("\n✅ Test complete! Check the database for the generated article.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  });
