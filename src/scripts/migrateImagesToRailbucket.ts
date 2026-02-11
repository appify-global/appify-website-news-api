import { prisma } from "../lib/prisma";
import { uploadImageToRailbucket } from "../services/railbucket";
import slugify from "slugify";

/**
 * Migrate all existing article images to Railbucket.
 * Downloads images from current URLs and uploads them to Railbucket,
 * then updates the article's imageUrl in the database.
 */
export async function migrateImagesToRailbucket(): Promise<void> {
  console.log("[Migration] Starting image migration to Railbucket...\n");

  // Get all articles with image URLs that are NOT already in Railbucket
  const articles = await prisma.article.findMany({
    where: {
      imageUrl: {
        not: {
          contains: "t3.storageapi.dev",
        },
      },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      imageUrl: true,
    },
  });

  console.log(`[Migration] Found ${articles.length} articles to migrate\n`);

  if (articles.length === 0) {
    console.log("[Migration] No articles to migrate. All images are already in Railbucket.");
    return;
  }

  let successCount = 0;
  let failCount = 0;
  const errors: Array<{ title: string; error: string }> = [];

  for (const article of articles) {
    if (!article.imageUrl) continue;

    try {
      console.log(`[Migration] Migrating: ${article.title.substring(0, 60)}...`);

      // Generate filename based on article slug
      const filename = `${slugify(article.slug, { lower: true, strict: true })}-${Date.now()}.png`;

      // Upload to Railbucket
      const railbucketUrl = await uploadImageToRailbucket(article.imageUrl, filename);

      // Update article with new Railbucket URL
      await prisma.article.update({
        where: { id: article.id },
        data: { imageUrl: railbucketUrl },
      });

      console.log(`  ✅ Migrated: ${railbucketUrl}`);
      successCount++;
    } catch (error: any) {
      console.error(`  ❌ Failed: ${error.message}`);
      failCount++;
      errors.push({
        title: article.title,
        error: error.message,
      });
    }
  }

  console.log(`\n[Migration] Complete!`);
  console.log(`  ✅ Success: ${successCount}`);
  console.log(`  ❌ Failed: ${failCount}`);

  if (errors.length > 0) {
    console.log(`\n[Migration] Errors:`);
    errors.forEach(({ title, error }) => {
      console.log(`  - ${title.substring(0, 50)}...: ${error}`);
    });
  }
}

// Allow running directly: tsx src/scripts/migrateImagesToRailbucket.ts
if (require.main === module) {
  migrateImagesToRailbucket()
    .then(() => {
      console.log("\n[Migration] Done!");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[Migration] Fatal error:", err);
      process.exit(1);
    });
}
