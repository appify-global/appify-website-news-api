import OpenAI from "openai";
import { RSSItem } from "./rss";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a blog post from an RSS article using OpenAI GPT-4o.
 * Mirrors the Make.com GPT step with the same prompts.
 */
export async function generateBlogContent(item: RSSItem): Promise<string> {
  console.log(`[OpenAI] Generating blog for: ${item.title}`);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    temperature: 1,
    max_tokens: 2500,
    messages: [
      {
        role: "system",
        content: `Write a blog for Appify Australia around the information in the article while reflecting on it as a thought leader: ${item.link}`,
      },
      {
        role: "assistant",
        content: `Rule 1: Make sure to provide Headings for the relevant sections of the blog i.e., Introduction, Conclusion, etc.

Rule 2: The blog length MUST be between 1200 - 1800 words.

Important: Focus on why this news matters, not just what happened and avoid marketing speak or SEO padding - look like human written content. Keep it clear, insightful, and relevant to people who care about Mobile apps, Technology, innovative software.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty content");
  }

  console.log(`[OpenAI] Generated ${content.split(" ").length} words.`);
  return content;
}
