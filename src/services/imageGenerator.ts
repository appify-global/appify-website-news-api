import OpenAI from "openai";
import { uploadImageToRailbucket } from "./railbucket";
import slugify from "slugify";

let xai: OpenAI;

function getXAI(): OpenAI {
  if (!xai) {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      throw new Error("XAI_API_KEY environment variable is not set");
    }
    xai = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://api.x.ai/v1",
    });
  }
  return xai;
}

/**
 * Generate a blog hero image using Grok (xAI) image generation.
 * Downloads the image and uploads it to Railway Railbucket.
 * Returns the Railbucket URL.
 */
export async function generateImage(title: string, topic: string): Promise<string> {
  console.log(`[Grok] Generating image for: ${title}`);
  
  // Check if API key is set
  if (!process.env.XAI_API_KEY) {
    throw new Error("XAI_API_KEY is not set. Cannot generate image with Grok.");
  }

  // Create a more relevant prompt based on the article title and topic
  // Extract key concepts from title to make the image more relevant
  const titleLower = title.toLowerCase();
  let imageDescription = "";
  
  // Generate relevant image description based on article content
  if (titleLower.includes("ai") || titleLower.includes("artificial intelligence") || titleLower.includes("agent")) {
    imageDescription = "futuristic AI technology, neural networks, digital brain, artificial intelligence visualization";
  } else if (titleLower.includes("app") || titleLower.includes("development") || titleLower.includes("software")) {
    imageDescription = "modern software development, code visualization, app interface, digital technology";
  } else if (titleLower.includes("startup") || titleLower.includes("business") || titleLower.includes("company")) {
    imageDescription = "modern business workspace, startup environment, innovation, growth";
  } else if (titleLower.includes("web3") || titleLower.includes("blockchain") || titleLower.includes("crypto")) {
    imageDescription = "blockchain technology, decentralized network, digital currency, web3 infrastructure";
  } else if (titleLower.includes("design") || titleLower.includes("ux") || titleLower.includes("ui")) {
    imageDescription = "modern design interface, user experience, creative design elements, digital aesthetics";
  } else if (titleLower.includes("automation") || titleLower.includes("workflow")) {
    imageDescription = "automation technology, workflow visualization, process optimization, digital efficiency";
  } else if (titleLower.includes("work") || titleLower.includes("workplace") || titleLower.includes("culture")) {
    imageDescription = "modern workplace, collaboration, professional environment, team culture";
  } else {
    imageDescription = "modern technology, innovation, digital transformation";
  }

  const prompt = `Create a professional, modern blog hero image representing: ${imageDescription}. Article topic: ${topic}. Style: clean, minimalist, futuristic, suitable for a technology blog. No text, no words, just visual elements.`;

  const response = await getXAI().images.generate({
    model: "grok-2-image",
    prompt: prompt,
    n: 1,
    // Note: Grok-2-image doesn't support size parameter - it generates at a fixed size
  });

  const imageUrl = response.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error("Grok returned no image");
  }

  console.log("[Grok] Image generated successfully.");

  // Upload to Railbucket
  try {
    const filename = `${slugify(title, { lower: true, strict: true })}-${Date.now()}.png`;
    const railbucketUrl = await uploadImageToRailbucket(imageUrl, filename);
    console.log("[Grok] Image uploaded to Railbucket.");
    return railbucketUrl;
  } catch (error) {
    console.error("[Grok] Failed to upload to Railbucket, using original URL:", error);
    // Fallback to original URL if Railbucket upload fails
    return imageUrl;
  }
}
