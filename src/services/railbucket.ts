import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import https from "https";
import http from "http";
import { URL } from "url";

let s3Client: S3Client | null = null;

/**
 * Get or create S3 client for Railway Railbucket (S3-compatible)
 */
function getS3Client(): S3Client {
  if (!s3Client) {
    const endpoint = process.env.RAILBUCKET_ENDPOINT || "https://t3.storageapi.dev";
    const region = process.env.RAILBUCKET_REGION || "auto";
    const accessKeyId = process.env.RAILBUCKET_ACCESS_KEY_ID;
    const secretAccessKey = process.env.RAILBUCKET_SECRET_ACCESS_KEY;

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        "RAILBUCKET_ACCESS_KEY_ID and RAILBUCKET_SECRET_ACCESS_KEY must be set"
      );
    }

    s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: false, // Use virtual-hosted-style URLs
    });
  }

  return s3Client;
}

/**
 * Upload an image to Railway Railbucket.
 * Downloads the image from a URL and uploads it to Railbucket using S3-compatible API.
 * Returns a signed URL since Railway Railbucket buckets are not publicly accessible.
 */
export async function uploadImageToRailbucket(
  imageUrl: string,
  filename: string
): Promise<string> {
  console.log(`[Railbucket] Uploading image: ${filename}`);

  const bucketName = process.env.RAILBUCKET_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("RAILBUCKET_BUCKET_NAME environment variable is not set");
  }

  // Download the image
  const imageBuffer = await downloadImage(imageUrl);

  // Upload to Railbucket using S3 API
  const s3Client = getS3Client();
  const putCommand = new PutObjectCommand({
    Bucket: bucketName,
    Key: filename,
    Body: imageBuffer,
    ContentType: "image/png", // Default to PNG
  });

  try {
    await s3Client.send(putCommand);
    
    // Generate signed URL (valid for 1 week - maximum allowed by S3)
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: filename,
    });
    const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 604800 }); // 1 week (max allowed)
    
    console.log(`[Railbucket] Image uploaded successfully (signed URL): ${signedUrl}`);
    return signedUrl;
  } catch (error: any) {
    console.error("[Railbucket] Upload failed:", error);
    throw new Error(`Railbucket upload failed: ${error.message}`);
  }
}

/**
 * Generate a signed URL for an existing image in Railbucket.
 * Useful for regenerating signed URLs for existing images.
 */
export async function getSignedImageUrl(filename: string): Promise<string> {
  const bucketName = process.env.RAILBUCKET_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("RAILBUCKET_BUCKET_NAME environment variable is not set");
  }

  const s3Client = getS3Client();
  const getCommand = new GetObjectCommand({
    Bucket: bucketName,
    Key: filename,
  });
  
  // Generate signed URL valid for 10 years
  // Generate signed URL (valid for 1 week - maximum allowed by S3)
  const signedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 604800 }); // 1 week
  return signedUrl;
}

/**
 * Extract filename from a Railbucket URL (public or signed)
 */
export function extractFilenameFromUrl(url: string): string | null {
  try {
    // Handle signed URLs (they contain query parameters)
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

/**
 * Download an image from a URL and return as Buffer
 */
async function downloadImage(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "https:" ? https : http;

    client
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }

        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
        response.on("error", reject);
      })
      .on("error", reject);
  });
}
