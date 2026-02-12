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

Analyze the RSS article at ${item.link} and extract the underlying evergreen theme or concept. Do NOT center the article around the company mentioned. Instead, build an SEO-focused article targeting a stable search intent within: App development, AI integration, Digital transformation, or Community-driven platforms.

Use any company examples only as supporting context, not as the article's focus.`,
      },
      {
        role: "assistant",
        content: `CRITICAL REQUIREMENTS:

1. **Word Count**: The article MUST be between 1,200-1,600 words. No more, no less.

2. **Evergreen Theme Extraction**: 
   - Extract the underlying evergreen concept from the RSS content
   - Do NOT center the article around the specific company mentioned
   - Build the article around the broader theme, principle, or strategy
   - Use company examples only as supporting context or case studies

3. **Target Search Intent**: Focus on stable, long-term search intent within:
   - App development
   - AI integration
   - Digital transformation
   - Community-driven platforms

4. **Required Structure**:
   - **Definition Section**: Clearly define the core concept, technology, or strategy (what it is, why it matters)
   - **Practical Implementation Section**: Provide actionable guidance on how to implement, adopt, or apply the concept
   - Additional sections as needed for depth (but avoid generic filler)

5. **Primary Keyword**: Identify and naturally integrate ONE clear primary keyword throughout:
   - In the title (H1) - should reflect the evergreen theme, not the company
   - Within first 100 words
   - In 2-3 subheadings
   - Throughout body paragraphs (natural density ~1-2%)
   - In conclusion

6. **Content Quality**:
   - Avoid generic praise language ("revolutionary", "game-changing", etc.)
   - Avoid promotional tone
   - Feel like industry thought leadership, not commentary on news
   - Include practical insights and strategic depth
   - Provide actionable value
   - Use authoritative, professional tone
   - NO emojis
   - NO mention of the original RSS source or article
   - NO centering content around specific companies

7. **Tone**: Authoritative, professional, expert-level. Write for founders, CTOs, and product managers seeking strategic insights and implementation guidance.

8. **Core Topics Alignment**: Ensure content aligns with one or more of:
   - AI software / AI integration
   - Digital transformation
   - App development
   - Workforce automation
   - Emerging technology strategy

9. **Company Mentions**: If companies are mentioned in the RSS article:
   - Use them as examples or case studies only
   - Do not make them the focus
   - Extract the broader lesson, strategy, or principle
   - Position as "one example" or "as demonstrated by" rather than centering the narrative

Generate the article now, focusing on the evergreen theme, not the company.`,
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
