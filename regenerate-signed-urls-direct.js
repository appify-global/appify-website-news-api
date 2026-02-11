const { PrismaClient } = require('@prisma/client');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || "postgresql://postgres:SutGuMkPQWYuWNudhUrpDWYWQgfUHYWZ@shortline.proxy.rlwy.net:53169/railway"
    }
  }
});

function extractFilenameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    if (pathParts.length >= 2) {
      return pathParts[pathParts.length - 1];
    }
    return null;
  } catch {
    return null;
  }
}

async function getSignedImageUrl(filename) {
  // Get credentials from environment or use defaults from Railway
  const bucketName = process.env.RAILBUCKET_BUCKET_NAME || "appify-railbucket-oa2fx2s";
  const endpoint = process.env.RAILBUCKET_ENDPOINT || "https://t3.storageapi.dev";
  const region = process.env.RAILBUCKET_REGION || "auto";
  
  // Try to get from environment, or prompt user
  const accessKeyId = process.env.RAILBUCKET_ACCESS_KEY_ID;
  const secretAccessKey = process.env.RAILBUCKET_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey) {
    console.error("\n❌ Missing Railbucket credentials!");
    console.error("\nTo get credentials:");
    console.error("1. Go to Railway → Appify-Railbucket service");
    console.error("2. Open the 'Credentials' tab");
    console.error("3. Copy 'Access Key ID' and 'Secret Access Key'");
    console.error("\nThen set environment variables:");
    console.error("  $env:RAILBUCKET_ACCESS_KEY_ID='your-access-key-id'");
    console.error("  $env:RAILBUCKET_SECRET_ACCESS_KEY='your-secret-access-key'");
    console.error("\nOr run: node regenerate-signed-urls-direct.js");
    throw new Error("RAILBUCKET_ACCESS_KEY_ID and RAILBUCKET_SECRET_ACCESS_KEY must be set");
  }

  const s3Client = new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: false,
  });

  const getCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: filename,
  });
  
  const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 604800 }); // 1 week (max allowed)
  return signedUrl;
}

(async () => {
  console.log("🔄 Regenerating signed URLs for Railbucket images...\n");

  // Get all articles with Railbucket images
  const articles = await prisma.article.findMany({
    where: {
      imageUrl: {
        contains: "t3.storageapi.dev",
      },
    },
    select: {
      id: true,
      title: true,
      imageUrl: true,
    },
  });

  if (articles.length === 0) {
    console.log("No Railbucket images found.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${articles.length} articles with Railbucket images.\n`);

  let regenerated = 0;
  let failed = 0;

  for (const article of articles) {
    try {
      const filename = extractFilenameFromUrl(article.imageUrl || "");
      if (!filename) {
        console.warn(`⚠️  Could not extract filename from: ${article.imageUrl}`);
        failed++;
        continue;
      }

      console.log(`Processing: ${article.title.substring(0, 50)}...`);
      console.log(`  Filename: ${filename}`);

      const signedUrl = await getSignedImageUrl(filename);
      
      await prisma.article.update({
        where: { id: article.id },
        data: { imageUrl: signedUrl },
      });

      console.log(`  ✅ Updated with signed URL\n`);
      regenerated++;
    } catch (error) {
      console.error(`  ❌ Failed: ${error.message}\n`);
      failed++;
    }
  }

  console.log(`\n✅ Complete!`);
  console.log(`  Regenerated: ${regenerated}`);
  console.log(`  Failed: ${failed}`);

  await prisma.$disconnect();
})();
