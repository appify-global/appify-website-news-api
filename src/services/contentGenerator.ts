import OpenAI from "openai";
import { RSSItem } from "./rss";

let openai: OpenAI;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Generate a blog post from an RSS article using OpenAI GPT-4o.
 * Mirrors the Make.com GPT step with the same prompts.
 */
export async function generateBlogContent(item: RSSItem): Promise<string> {
  console.log(`[OpenAI] Generating blog for: ${item.title}`);

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    temperature: 0.8, // Slightly lower for more focused, authoritative content
    max_tokens: 4000, // For 1,200-1,600 word articles
    messages: [
      {
        role: "system",
        content: `You are an authoritative thought leader writing for Appify Australia, a leading app development and digital transformation agency. Your goal is to create evergreen, SEO-optimized content that builds long-term topical authority.

Analyze the RSS article at ${item.link} and extract the core evergreen concept behind the news. Ignore time-sensitive framing and news-specific details. Generate a fully original article that contributes to long-term SEO authority, not short-term traffic.`,
      },
      {
        role: "assistant",
        content: `CRITICAL REQUIREMENTS:

1. **Word Count**: The article MUST be between 1,200-1,600 words. No more, no less.

2. **Originality**: This must be a fully original article. Do NOT rewrite or summarize the original RSS article. Extract the evergreen concept and create new, original content around it.

3. **Evergreen Focus**: Ignore time-sensitive news framing. Focus on the underlying concept, principles, strategies, and insights that remain relevant long-term.

4. **Structure**: Use clear, logical headings (H2, H3). Structure should flow naturally based on the topic. Avoid generic filler sections like "What is X?" if it doesn't add value. Focus on:
   - Strategic insights
   - Practical applications
   - Implementation guidance
   - Industry implications
   - Best practices (when relevant)

5. **Primary Keyword**: Identify and naturally integrate ONE clear primary keyword throughout:
   - In the title (H1)
   - Within first 100 words
   - In 2-3 subheadings
   - Throughout body paragraphs (natural density ~1-2%)
   - In conclusion

6. **Content Quality**:
   - Avoid generic filler sections
   - Avoid repeated phrasing or redundant statements
   - Include practical insights and strategic depth
   - Provide actionable value
   - Use authoritative, professional tone
   - NO emojis
   - NO mention of the original RSS source or article

7. **Target Search Intent**: Focus on stable, long-term search intent (how-to, what-is, best-practices, strategic guidance) rather than news-based queries.

8. **Tone**: Authoritative, professional, expert-level. Write for founders, CTOs, and product managers seeking strategic insights.

9. **Core Topics Alignment**: Ensure content aligns with one or more of:
   - AI software
   - Digital transformation
   - App development
   - Workforce automation
   - Emerging technology strategy

Generate the article now.`,
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
