import OpenAI from "openai";
import { RSSItem } from "./rss";
import { detectTopic, getTopicBlueprint } from "./topicDetector";

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

  // Detect topic and get blueprint
  const topic = detectTopic(item);
  const blueprint = getTopicBlueprint(topic);
  
  console.log(`[OpenAI] Detected topic: ${topic}`);
  console.log(`[OpenAI] Using blueprint: ${blueprint.h1}`);

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    temperature: 0.8, // Slightly lower for more focused, authoritative content
    max_tokens: 4000, // For 1,200-1,600 word articles
    messages: [
      {
        role: "system",
        content: `You are an authoritative thought leader writing for Appify Australia, a leading app development and digital transformation agency. Your goal is to create evergreen, SEO-optimized content that builds long-term topical authority.

Analyze the RSS article at ${item.link} and extract the underlying evergreen theme or concept. Do NOT center the article around the company mentioned. Instead, build an SEO-focused article using the topic blueprint provided.

Use any company examples only as supporting context, not as the article's focus.

TOPIC BLUEPRINT:
- H1 Title: ${blueprint.h1}
- Required Sections (use these exact headings):
${blueprint.sections.map((s, i) => `  ${i + 1}. ## ${s}`).join('\n')}

Topic Description: ${blueprint.description}`,
      },
      {
        role: "assistant",
        content: `CRITICAL REQUIREMENTS:

1. **Word Count**: The article MUST be at least 1,200 words. Target 1,200-1,600 words for optimal SEO.

2. **Output Format - CRITICAL**:
   - Output ONLY the article content in markdown format
   - Use ## for H2 headings (use the EXACT headings from the blueprint)
   - Use ### for H3 subheadings if needed within sections
   - Use regular paragraphs (no markdown formatting like **bold** or *italic*)
   - NO explanations, NO introductions like "Here's an article..." or "This article covers..."
   - NO markdown code blocks (no \`\`\`)
   - NO HTML tags
   - Start directly with the first section heading - no preamble
   - End directly with the last section content - no conclusion statements

3. **Required Structure - USE THE BLUEPRINT HEADINGS**:
   - You MUST use the exact section headings provided in the blueprint
   - Start with the first section heading: ## ${blueprint.sections[0]}
   - Follow with the remaining sections in order: ${blueprint.sections.slice(1).map(s => `## ${s}`).join(', ')}
   - Each section must have 2-3 substantial paragraphs (minimum 150 words per section)
   - DO NOT use generic headings like "Why It Matters", "Industry Response", "Future Outlook"

4. **Content Requirements**:
   - **Definition Section**: Start with ${blueprint.sections[0]} - provide a clear, comprehensive definition (2-3 paragraphs)
   - **Implementation Depth**: Include specific, actionable guidance in implementation sections
   - **Trade-offs/Risks**: Include at least one section discussing trade-offs, risks, or considerations
   - **Use Cases**: Include real-world examples and use cases where relevant
   - **Company Examples**: Use the RSS company only as a supporting example (1-2 sentences max), not the main focus

5. **Evergreen Theme Extraction**: 
   - Extract the underlying evergreen concept from the RSS content
   - Do NOT center the article around the specific company mentioned
   - Build the article around the broader theme, principle, or strategy
   - Use company examples only as supporting context or case studies

6. **Primary Keyword**: Identify and naturally integrate ONE clear primary keyword throughout:
   - In the H1 title (already provided in blueprint)
   - Within first 100 words
   - In 2-3 section headings
   - Throughout body paragraphs (natural density ~1-2%)

7. **Content Quality**:
   - Avoid generic filler phrases like "industry landscape continues to evolve" or "maintain competitive advantage"
   - Avoid generic praise language ("revolutionary", "game-changing", etc.)
   - Avoid promotional tone
   - Feel like industry thought leadership, not commentary on news
   - Include practical insights and strategic depth
   - Provide actionable value with specific implementation guidance
   - Use authoritative, professional tone
   - NO emojis
   - NO mention of the original RSS source or article
   - NO centering content around specific companies

8. **Tone**: Authoritative, professional, expert-level. Write for founders, CTOs, and product managers seeking strategic insights and implementation guidance.

9. **Company Mentions**: If companies are mentioned in the RSS article:
   - Use them as examples or case studies only (1-2 sentences maximum)
   - Do not make them the focus
   - Extract the broader lesson, strategy, or principle
   - Position as "one example" or "as demonstrated by" rather than centering the narrative

Generate the article now using the blueprint structure. Output ONLY the article content in markdown format - start with the first section heading, use the exact headings provided, no explanations, no introductions, no conclusions.`,
      },
    ],
  });

  let content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty content");
  }

  // Clean up any AI explanations or markdown code blocks
  // Remove markdown code blocks (```markdown, ```, etc.)
  content = content.replace(/```[a-z]*\s*/gi, "");
  content = content.replace(/```\s*/g, "");
  
  // Remove common AI explanation patterns
  content = content.replace(/^(Here's|Here is|This article|This content|The following|Below is).*?:\s*/gim, "");
  content = content.replace(/^(I'll|I will|Let me|I'm going to).*?\.\s*/gim, "");
  
  // Remove any text before first heading or paragraph
  const firstHeading = content.search(/^##\s+/m);
  const firstParagraph = content.search(/^[A-Z]/m);
  const startIndex = firstHeading !== -1 ? firstHeading : (firstParagraph !== -1 ? firstParagraph : 0);
  if (startIndex > 0) {
    content = content.substring(startIndex);
  }
  
  // Remove any trailing explanations
  content = content.replace(/\n\n*(In conclusion|To summarize|In summary|Overall|Finally).*$/gim, "");
  
  // Clean up extra whitespace
  content = content.trim();

  console.log(`[OpenAI] Generated ${content.split(" ").length} words.`);
  return content;
}
