/**
 * Simple script to generate articles
 */

import { generateArticles } from "../src/cron/generateArticles";
import { prisma } from "../src/lib/prisma";

async function generate() {
  try {
    console.log("[Script] Generating articles...");
    await generateArticles();
    console.log("[Script] ✅ Article generation complete!");
  } catch (error: any) {
    console.error("[Script] Error:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

generate();
