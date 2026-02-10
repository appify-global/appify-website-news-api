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
 * Mirrors the Make.com Claude title generation step.
 */
export async function generateBlogTitle(blogContent: string): Promise<string> {
  console.log("[OpenAI] Generating blog title...");

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    temperature: 1,
    max_tokens: 500,
    messages: [
      {
        role: "system",
        content: `When generating the blog title, return only the raw title as plain text. Do not use Markdown formatting (e.g. no '#' symbols or bold text).

Rule 1: Must be under 60 characters in total.

Rule 2: Include one primary keyword from the list below, if it fits naturally:
– app development company
– AI app development
– mobile app developers
– custom software development
– app developers Australia

Rule 3: **Avoid all caps, emojis, or salesy punctuation** (e.g. exclamation marks).

Rule 4: Do **not start with numbers** unless it's genuinely a listicle (e.g. "5 Steps to Launch an AI App").

Rule 5: Prioritise clarity over cleverness. The reader should **immediately understand** what the blog is about.

Rule 6: Never use vague phrases like "The Future of…" or "How Technology is Changing…" unless the blog is genuinely about that.

Rule 7: **Location mentions** (e.g. Australia, Melbourne) are optional but valuable if the blog is targeting local SEO.`,
      },
      {
        role: "user",
        content: `Create a title for this blog:\n\n${blogContent.slice(0, 2000)}`, // First 2000 chars for context
      },
    ],
  });

  const title = response.choices[0]?.message?.content?.trim();
  if (!title) {
    throw new Error("OpenAI returned empty title");
  }

  // Remove any markdown formatting that might slip through
  const cleanTitle = title.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
  
  // Ensure it's under 60 characters
  const finalTitle = cleanTitle.length > 60 ? cleanTitle.slice(0, 57) + "..." : cleanTitle;

  console.log(`[OpenAI] Generated title: ${finalTitle}`);
  return finalTitle;
}
