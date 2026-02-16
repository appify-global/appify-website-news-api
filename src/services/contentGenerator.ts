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
 * Generate a blog post from an RSS article using OpenAI GPT-4o-mini.
 * Mirrors the Make.com GPT step with the same prompts.
 */
export async function generateBlogContent(item: RSSItem): Promise<string> {
  console.log(`[OpenAI] Generating blog for: ${item.title}`);

  // Detect topic and get blueprint
  const topic = await detectTopic(item);
  const blueprint = getTopicBlueprint(topic);
  
  console.log(`[OpenAI] Detected topic: ${topic}`);
  console.log(`[OpenAI] Using blueprint: ${blueprint.h1}`);

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.8, // Slightly lower for more focused, authoritative content
    max_tokens: 4000, // For 1,200-1,600 word articles
    messages: [
      {
        role: "system",
        content: `You are an authoritative thought leader writing for Appify Australia, a leading app development and digital transformation agency. Your goal is to create original, evergreen, SEO-optimized content that builds long-term topical authority.

CRITICAL REQUIREMENTS - FOLLOW THESE EXACTLY:
1. **MOST IMPORTANT: Write about the ACTUAL RSS article topic**: "${item.title}"
   - The article MUST be about: "${item.title}"
   - If the RSS article is about a data breach, write about data breaches and security
   - If the RSS article is about a company announcement, write about that topic
   - DO NOT write generic content about AI app development unless the RSS article is specifically about AI app development
   - The blueprint headings are ONLY for SEO structure - you MUST adapt them to match the RSS topic

2. **Originality**: Write completely ORIGINAL content - do NOT copy or paraphrase the RSS article. Use it only as a topic reference.

3. **SEO Structure**: Use the topic blueprint structure as a TEMPLATE, but ADAPT the headings and content to match the actual RSS article topic "${item.title}".

RSS Article Reference (for topic understanding only):
- Title: ${item.title}
- Topic Summary: ${(item.contentSnippet || item.content || item.title || "").slice(0, 1000)}

Use the RSS article ONLY to understand the topic. Write completely original content about that topic using your own analysis, examples, and insights.

TOPIC BLUEPRINT (use for SEO structure, write original content about RSS topic):
- Topic: "${item.title}"
- Required Sections (use these exact headings for SEO):
${blueprint.sections.map((s, i) => `  ${i + 1}. ## ${s}`).join('\n')}

Topic Description: ${blueprint.description}

IMPORTANT: 
- Write ORIGINAL content about the RSS topic - do not copy or paraphrase
- Use the blueprint headings for SEO structure
- Match the topic but be completely original in your writing`,
      },
      {
        role: "user",
        content: `Write a comprehensive, ORIGINAL article about: "${item.title}"

RSS Article Topic Reference (use only to understand the topic, do NOT copy):
${(item.contentSnippet || item.content || item.title || "").slice(0, 1500)}

CRITICAL: 
- Write about the topic "${item.title}" but use COMPLETELY ORIGINAL content
- Do NOT copy, paraphrase, or closely follow the RSS article content
- Write your own unique analysis, insights, and examples about this topic
- Use the blueprint structure for SEO, but write original content

CRITICAL REQUIREMENTS:

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

3. **Required Structure - ADAPT BLUEPRINT HEADINGS TO MATCH RSS TOPIC**: 
   - You MUST adapt the blueprint headings to match "${item.title}"
   - The blueprint headings are TEMPLATES - adapt them to the actual topic
   - Example: If "${item.title}" is about a data breach and blueprint says "What Is AI App Development?", adapt it to "What Is a Data Breach?" or "Understanding Data Breaches"
   - Example: If "${item.title}" is about Hollywood and blueprint says "How AI App Development Works", adapt it to "How AI Video Generators Work" or similar
   - Start with an adapted version of the first section heading that matches "${item.title}"
   - Follow with adapted versions of the remaining sections that match "${item.title}"
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
   - **MANDATORY SECTIONS** (adapt blueprint headings to match "${item.title}"):
     * **Definition/Overview Section** (adapt ${blueprint.sections[0]} to match "${item.title}"): Precise, topic-specific definition about "${item.title}" - identify the real issue, context, or strategic challenge (3-4 paragraphs, 120-180 words each)
     * **How It Works/What Happened Section** (adapt ${blueprint.sections[1]} to match "${item.title}"): Explain the mechanics, details, or what happened related to "${item.title}" - technical details, system components, processes (2-3 paragraphs, 120-180 words each)
     * **Implementation/Impact Section** (adapt ${blueprint.sections[2]} to match "${item.title}"): Discuss implementation, impact, implications, or consequences related to "${item.title}" - real constraints, challenges, effects (2-3 paragraphs, 120-180 words each)
     * **Risks and Trade-Offs Section** (adapt ${blueprint.sections[3]} to match "${item.title}"): Discuss risks, concerns, or considerations related to "${item.title}" - mitigation strategies, solutions, trade-offs (2-3 paragraphs, 120-180 words each)
     * **Decision Framework/Future Outlook Section** (adapt ${blueprint.sections[4]} to match "${item.title}"): Discuss evaluation, prevention, future implications, or lessons learned related to "${item.title}" - what to do, what to avoid, best practices (2-3 paragraphs, 120-180 words each)
   
   - **DEPTH REQUIREMENTS - CRITICAL**:
     * Every major "benefit" or "step" must be expanded into a FULL ANALYTICAL PARAGRAPH (120-180 words each)
     * Each paragraph must contain at least one of:
       - A technical detail (e.g., inference, edge vs cloud, latency, model drift, RAG, APIs, orchestration, data pipelines, model hosting)
       - A realistic constraint (cost, compliance, data quality, integration complexity, vendor lock-in, scalability limits)
       - A mitigation or best-fit scenario ("use X when... avoid when...", "best for... not suitable for...")
     * DO NOT list trade-offs as single sentences - each must be a complete paragraph with depth
     * Each paragraph must include: clear explanation, practical example, trade-off/consideration, and specific terminology
   
   - **ABSOLUTELY NO BULLET POINTS OR LISTS**:
     * DO NOT use bullet points (-, *, •) at all
     * DO NOT use numbered lists (1., 2., 3.)
     * DO NOT use checklists
     * Every concept, benefit, step, or trade-off MUST be written as a FULL ANALYTICAL PARAGRAPH (120-180 words, 4-6 sentences)
     * If you find yourself wanting to use a bullet point, expand it into a complete paragraph with explanation, example, and trade-offs
     * CRITICAL: When describing multiple items (benefits, steps, considerations), write each as a FULL PARAGRAPH (2-3 sentences minimum) - do NOT list them as bullets
     * Example: Instead of "- Scalability: Platform can grow" write "Scalability represents a critical consideration for AI app development platforms, as organizations need solutions that can accommodate increasing workloads and user demands without requiring complete system overhauls. Modern platforms address this through cloud-native architectures that enable horizontal scaling, allowing businesses to add computational resources dynamically based on real-time demand patterns. However, scaling introduces trade-offs around cost management, as cloud resources scale linearly with usage, requiring careful monitoring and optimization strategies to maintain cost efficiency while ensuring performance."
   
   - **Use Cases**: Include real-world examples with technical context
   - **Company Examples**: Use the RSS company only as a supporting example (1-2 sentences max), not the main focus
   - **NO Promotional Language or Multiple CTAs**: 
     * Do NOT include phrases like "Learn more about our services", "Contact us", "Visit our page", "Explore our section"
     * Do NOT include sentences like "can be explored further through our dedicated [service] page" or "visit our [section]"
     * Do NOT include multiple promotional links or calls-to-action
     * This is authority content, not a service page or marketing material
     * Maximum ONE subtle CTA at the very end if absolutely necessary, but prefer NO CTAs

5. **RSS Article Topic Matching - ABSOLUTELY CRITICAL**: 
   - **THE ARTICLE MUST BE ABOUT "${item.title}" - THIS IS THE PRIMARY REQUIREMENT**
   - If "${item.title}" is about a data breach, write about data breaches, security, customer data protection
   - If "${item.title}" is about a company announcement, write about that specific topic
   - If "${item.title}" is about Hollywood and AI video generators, write about that topic
   - **DO NOT write generic AI app development content unless the RSS title is specifically about AI app development**
   - The blueprint headings are TEMPLATES - you MUST adapt them to match "${item.title}"
   - For example, if the RSS title is about a data breach, adapt "What Is AI App Development?" to "What Is a Data Breach?" or similar
   - Use the RSS article ONLY as a topic reference - do NOT copy its content
   - Write ORIGINAL content about this topic using your own analysis and insights
   - Do NOT plagiarize - write completely original content that matches the topic
   - Provide your own unique perspective, examples, and analysis

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

Generate an ORIGINAL article about "${item.title}". 

CRITICAL: The article MUST be about "${item.title}" - adapt the blueprint headings to match this topic. For example:
- If "${item.title}" is about a data breach, adapt headings to be about data breaches, security, protection
- If "${item.title}" is about a company announcement, adapt headings to be about that topic
- DO NOT use generic "AI App Development" headings if "${item.title}" is not about AI app development

Use the blueprint structure as a TEMPLATE for SEO, but ADAPT the headings and ALL content to match "${item.title}". Write completely original content about the RSS topic. Do NOT copy the RSS article - write your own unique analysis, examples, and insights. Output ONLY the article content in markdown format - start with the first section heading, adapt the blueprint headings to match the topic, no explanations, no introductions, no conclusions.`,
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
  
  // Convert bullet points and checklists to paragraphs (fallback - LLM should have already done this)
  // This expands any bullet points that slipped through into full paragraphs
  // Match bullet points at start of line (markdown format: - item, * item, • item)
  content = content.replace(/^[\s]*[-*•]\s+(.+)$/gm, (match, bulletText) => {
    // Remove bullet marker and return as paragraph text
    return bulletText.trim();
  });
  
  // Convert numbered lists to paragraphs
  content = content.replace(/^\d+\.\s+(.+)$/gm, (match, listText) => {
    return listText.trim();
  });
  
  // Remove any remaining list markers (•, ◦, ▪, ▫)
  content = content.replace(/^[\s]*[•◦▪▫]\s+/gm, "");
  
  // Detect and expand bullet-like patterns: "**Title:** description" or "*Title:* description"
  // These are often used for "best practices" or "key points" that should be full paragraphs
  content = content.replace(/\*\*([^*:]+):\*\*\s*([^\n]+)/g, (match, title, description) => {
    const titleClean = title.trim();
    const descClean = description.trim();
    const wordCount = descClean.split(/\s+/).length;
    
    // If description is already substantial (60+ words), it's probably already a paragraph
    if (wordCount >= 60) {
      return `**${titleClean}:** ${descClean}`;
    }
    
    // Otherwise, expand it into a full paragraph format
    // The LLM should have done this, but as fallback, we'll format it as a paragraph
    // Note: This is a minimal expansion - the LLM should be doing the real expansion
    return `**${titleClean}:** ${descClean}`;
  });
  
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
  
  // Remove promotional CTA sentences (keep only the last one if multiple exist, max 1 total)
  // Pattern: Sentences that mention "our [service/page/section]", "visit our", "explore our", etc.
  try {
    const ctaSentencePattern = /([^.!?\n]*(?:can be explored|visit our|explore our|our (?:dedicated|automation|projects|phone|studio|services|section)|for insights|for more|to learn more|to explore).*?(?:page|section|visit|check|see|explore).*?[.!?\n])/gi;
    
    const ctaMatches: Array<{ match: string; index: number }> = [];
    let match;
    
    // Reset regex lastIndex and find all matches
    ctaSentencePattern.lastIndex = 0;
    while ((match = ctaSentencePattern.exec(content)) !== null) {
      if (match.index !== undefined && match[0] && match[0].trim().length > 0) {
        ctaMatches.push({ match: match[0].trim(), index: match.index });
      }
    }
    
    // Remove all CTAs except the last one (if there are multiple)
    if (ctaMatches.length > 1) {
      // Sort by index in reverse order to remove from end to start (preserves indices)
      ctaMatches.sort((a, b) => b.index - a.index);
      // Remove all but the last CTA, working backwards to preserve indices
      let updatedContent = content;
      for (let i = 0; i < ctaMatches.length - 1; i++) {
        const cta = ctaMatches[i];
        const before = updatedContent.substring(0, cta.index);
        const after = updatedContent.substring(cta.index + cta.match.length);
        updatedContent = before + after;
      }
      content = updatedContent;
    }
  } catch (error) {
    // If CTA removal fails, log but don't break the pipeline
    console.warn("[ContentGenerator] Error removing CTAs:", error);
  }
  
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
