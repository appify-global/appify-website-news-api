import OpenAI from "openai";

let openai: OpenAI;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Generate SEO-friendly blog title using OpenAI.
 * Makes only slight modifications to the original RSS title for SEO optimization.
 */
export async function generateBlogTitle(blogContent: string, originalTitle?: string): Promise<string> {
  console.log("[OpenAI] Generating blog title...");

  // If we have an original title, use it as the base and make minimal changes
  const baseTitle = originalTitle || "";
  
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3, // Lower temperature for more consistent, minimal changes
    max_tokens: 100,
    messages: [
      {
        role: "system",
        content: `You are a title optimizer. Your job is to make MINIMAL changes to the original title for SEO purposes.

CRITICAL RULES:
1. **Keep the original title's meaning and structure** - only make slight adjustments
2. If the original title is already good (under 60 chars, clear, has relevant keywords), keep it as-is or make only tiny tweaks
3. If the original title is too long (>60 chars), shorten it slightly while keeping the core meaning
4. If the original title lacks SEO keywords, add ONE keyword naturally (e.g., "AI app development", "app development") ONLY if it fits naturally
5. Do NOT rewrite the title completely - preserve the original essence
6. Return ONLY the optimized title, no explanations

Return the title as plain text (no markdown, no quotes, no formatting).`,
      },
      {
        role: "user",
        content: baseTitle 
          ? `Original title: "${baseTitle}"\n\nBlog content preview:\n${blogContent.slice(0, 1000)}\n\nMake only MINIMAL SEO adjustments to the original title. Keep the same meaning and structure.`
          : `Create a title for this blog:\n\n${blogContent.slice(0, 2000)}`,
      },
    ],
  });

  const title = response.choices[0]?.message?.content?.trim();
  if (!title) {
    // Fallback to original title if generation fails
    if (baseTitle) {
      console.log(`[OpenAI] Title generation failed, using original: ${baseTitle}`);
      return baseTitle.length > 60 ? baseTitle.slice(0, 57) + "..." : baseTitle;
    }
    throw new Error("OpenAI returned empty title");
  }

  // Remove any markdown formatting, quotes, or extra text that might slip through
  let cleanTitle = title.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
  // Remove surrounding quotes if present
  cleanTitle = cleanTitle.replace(/^["']|["']$/g, "");
  
  // If we have an original title and the new one is very different, prefer a minimal change
  if (baseTitle && cleanTitle.toLowerCase() !== baseTitle.toLowerCase()) {
    const similarity = calculateTitleSimilarity(cleanTitle, baseTitle);
    // If similarity is too low (<70%), the AI changed it too much - use original with minimal tweaks
    if (similarity < 0.7) {
      console.log(`[OpenAI] Generated title too different from original (${Math.round(similarity * 100)}% similarity), using original with minimal tweaks`);
      // Just ensure length is OK
      return baseTitle.length > 60 ? baseTitle.slice(0, 57) + "..." : baseTitle;
    }
  }
  
  // Ensure it's under 60 characters
  const finalTitle = cleanTitle.length > 60 ? cleanTitle.slice(0, 57) + "..." : cleanTitle;

  console.log(`[OpenAI] Generated title: ${finalTitle}${baseTitle ? ` (from original: ${baseTitle})` : ""}`);
  return finalTitle;
}

// Helper function to calculate title similarity
function calculateTitleSimilarity(title1: string, title2: string): number {
  const words1 = title1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const words2 = title2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const commonWords = words1.filter(w => words2.includes(w));
  return commonWords.length / Math.max(words1.length, words2.length);
}
