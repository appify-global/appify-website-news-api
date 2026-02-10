import OpenAI from "openai";

let openai: OpenAI;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Generate meta description using OpenAI.
 * Mirrors the Make.com Claude meta description step.
 */
export async function generateMetaDescription(blogContent: string): Promise<string> {
  console.log("[OpenAI] Generating meta description...");

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    temperature: 1,
    max_tokens: 500,
    messages: [
      {
        role: "system",
        content: `Write a short meta description for the blog post that will be used as the SEO meta description and the post summary.

Follow these rules:

1. Keep the description under 210 characters.
2. Use only **one** of the following keywords if it fits naturally:
   app development company, AI app development, mobile app developers, custom software, app developers Australia
3. Write in a neutral, informative tone — avoid fluff, clickbait, or sales language.
4. Do not use the em dash (—) or symbols like #, %, $, *, etc.
5. Avoid phrases like "discover", "explore", "case study of", or "get in touch".
6. Only mention industries (e.g. mining, wine, healthcare) if it is central to the blog's focus — not as filler.
7. Do not force keyword placement. It should feel natural and contextually relevant.
8. Write as if explaining the article to a busy founder or CTO — make it clear and professional.
9. Output only the plain text of the meta description — no extra labels, markdown, or quotes.`,
      },
      {
        role: "user",
        content: `Here is the blog post content to base the meta description on:\n\n${blogContent.slice(0, 3000)}`, // First 3000 chars for context
      },
    ],
  });

  const description = response.choices[0]?.message?.content?.trim();
  if (!description) {
    throw new Error("OpenAI returned empty meta description");
  }

  // Remove quotes if wrapped
  const cleanDescription = description.replace(/^["']|["']$/g, "").trim();
  
  // Ensure it's under 210 characters
  const finalDescription = cleanDescription.length > 210 
    ? cleanDescription.slice(0, 207) + "..." 
    : cleanDescription;

  console.log(`[OpenAI] Generated meta description (${finalDescription.length} chars)`);
  return finalDescription;
}
