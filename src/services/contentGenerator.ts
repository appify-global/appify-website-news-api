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
   - NO bullet points, NO checklists, NO numbered lists
   - Write in full paragraphs with depth and analysis - each paragraph should be 3-5 sentences
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
   - Each paragraph must be a FULL ANALYTICAL PARAGRAPH (minimum 120-180 words, 4-6 sentences) - NO bullet points or checklists
   - Each paragraph MUST include:
     * A clear explanation of the concept
     * A practical example or implementation detail
     * At least one trade-off or consideration
     * Specific technical terminology (architecture, inference, APIs, governance, data pipelines, model lifecycle, etc.)
   - Write in full narrative paragraphs that explain concepts, provide context, and offer insights
   - DO NOT write generic summaries - every paragraph must have specific, actionable detail
   - DO NOT use filler phrases - every sentence must add value
   - DO NOT repeat the same structure across sections - vary paragraph structure and approach
   - DO NOT use generic headings like "Why It Matters", "Industry Response", "Future Outlook"
   - DO NOT repeat section headings - each heading should appear only once
   - DO NOT include a "Conclusion" section - end with the last content section

4. **Content Requirements - CRITICAL FOR AUTHORITY**:
   - **Definition Section**: Start with ${blueprint.sections[0]} - identify a real business pain or strategic challenge, hook enterprise readers, set authoritative tone (3-4 paragraphs)
   - **Technical Depth**: Include specific technical details:
     * Architecture patterns (APIs vs custom models, cloud vs edge, event-driven vs state machine)
     * System design considerations (data pipelines, inference layers, model hosting, monitoring)
     * Cost implications and trade-offs (vendor lock-in, latency, scalability)
     * Model lifecycle and governance (retraining, drift detection, compliance)
   - **Trade-offs/Risks Section**: Must include deep analysis of:
     * Technical risks (hallucinations, bias, security vulnerabilities)
     * Operational risks (governance, compliance, ongoing maintenance)
     * Strategic trade-offs (cost vs performance, vendor lock-in, scalability)
     * Each trade-off or consideration must be expanded into a FULL ANALYTICAL PARAGRAPH (minimum 120-180 words) with specific details, examples, and implications
     * DO NOT list trade-offs as single sentences - each must be a complete paragraph with depth
     * Each paragraph must include: clear explanation, practical example, trade-off/consideration, and specific terminology
   - **Implementation Depth**: Provide specific, actionable guidance with technical specifics:
     * Which technologies/frameworks and why
     * Architecture decisions and their implications
     * Deployment patterns and their trade-offs
     * Real-world constraints and how to address them
   - **Use Cases**: Include real-world examples with technical context
   - **Company Examples**: Use the RSS company only as a supporting example (1-2 sentences max), not the main focus
   - **NO Promotional Language**: Do NOT include phrases like "Learn more about our services" or "Contact us" - this is authority content, not a service page

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

7. **Content Quality - AUTHORITY LEVEL**:
   - Write in full analytical paragraphs with depth - NO bullet points, NO checklists, NO numbered lists
   - Each paragraph must be a FULL ANALYTICAL PARAGRAPH (minimum 120-180 words, 4-6 sentences)
   - Each paragraph MUST include:
     * A clear explanation of the concept
     * A practical example or implementation detail
     * At least one trade-off or consideration
     * Specific technical terminology (architecture, inference, APIs, governance, data pipelines, model lifecycle, etc.)
   - DO NOT write generic summaries - every paragraph must have specific, actionable detail
   - DO NOT use filler phrases like "industry landscape continues to evolve" or "maintain competitive advantage"
   - DO NOT repeat the same structure across sections - vary paragraph structure and approach
   - Avoid generic praise language ("revolutionary", "game-changing", etc.)
   - Avoid promotional tone - NO service pitches, NO "contact us", NO "learn more about our services"
   - Sound like technical authority content, not agency blog content
   - Include specific technical details: architecture patterns, system design, inference layers, model lifecycle, governance frameworks
   - Provide actionable value with specific implementation guidance, technical trade-offs, and real-world constraints
   - Discuss "how it actually works at system level" not just "why it's beneficial"
   - Use authoritative, expert-level tone for CTOs, technical leads, and enterprise decision-makers
   - NO emojis
   - NO mention of the original RSS source or article
   - NO centering content around specific companies
   - NO promotional endings or CTAs

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
  
  // Remove bullet points and checklists - convert to paragraphs
  // Remove markdown bullet points (-, *, •)
  content = content.replace(/^[\s]*[-*•]\s+/gm, "");
  // Remove numbered lists
  content = content.replace(/^\d+\.\s+/gm, "");
  // Remove any remaining list markers
  content = content.replace(/^[\s]*[•◦▪▫]\s+/gm, "");
  
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
  
  // Remove duplicate section headings (keep only first occurrence)
  const seenHeadings = new Set<string>();
  const lines = content.split('\n');
  const cleanedLines: string[] = [];
  
  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)$/);
    if (headingMatch) {
      const headingText = headingMatch[1].trim().toLowerCase();
      if (seenHeadings.has(headingText)) {
        // Skip duplicate heading and its content until next heading
        continue;
      }
      seenHeadings.add(headingText);
    }
    cleanedLines.push(line);
  }
  
  content = cleanedLines.join('\n');
  
  // Remove any "Conclusion" sections (we don't want conclusion sections)
  content = content.replace(/\n##\s+Conclusion\s*\n[\s\S]*$/gim, "");
  
  // Clean up extra whitespace
  content = content.trim();

  console.log(`[OpenAI] Generated ${content.split(" ").length} words.`);
  return content;
}
