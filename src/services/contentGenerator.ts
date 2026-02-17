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

  // Fetch the actual article content from the URL (like Make.com does)
  let articleContent = "";
  if (item.link) {
    try {
      const { fetchArticleContent } = await import("../services/contentGeneratorCode");
      const articleData = await fetchArticleContent(item.link);
      articleContent = articleData.content || "";
      console.log(`[OpenAI] Fetched article content from URL (${articleContent.length} chars)`);
    } catch (error: any) {
      console.warn(`[OpenAI] Could not fetch article content from URL: ${error.message}`);
      // Fallback to RSS content
      articleContent = item.contentSnippet || item.content || "";
    }
  } else {
    articleContent = item.contentSnippet || item.content || "";
  }

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 1, // Match Make.com temperature
    max_tokens: 2500, // Match Make.com max_tokens
    messages: [
      {
        role: "system",
        content: `Write a blog for Appify Australia around the information in the article while reflecting on it as a thought leader: ${item.link || item.title}`,
      },
      {
        role: "assistant",
        content: `Rule 1: Make sure to provide Headings for the relevant sections of the blog i.e., Introduction, Conclusion, etc.

Rule 2: The blog length MUST be between 1200 - 1800 words.

🚨 CRITICAL - TOPIC MATCHING & SEO REQUIREMENTS:

1. **YOU MUST WRITE ABOUT THE EXACT TOPIC IN THE RSS TITLE**: "${item.title}"
   - If the title is "Banking AI App Development in Multiple Business Functions at NatWest" → Write about NatWest's banking AI implementation, banking functions, NatWest's specific use cases
   - If the title is "Data breach at Company X" → Write about that specific data breach, security implications, protection measures
   - If the title is "Peter Steinberger joining OpenAI" → Write about executive moves, talent acquisition, company transitions
   - DO NOT write generic "AI App Development" content unless the title is specifically about generic AI app development
   - The article MUST be about "${item.title}" - nothing else

2. **HEADINGS MUST MATCH THE SPECIFIC TOPIC & INCLUDE KEYWORDS**:
   - Create headings that are specific to "${item.title}" and include relevant keywords
   - Example: If title is "Banking AI App Development at NatWest":
     * Use: "NatWest's AI Implementation Strategy in Banking" (NOT "Definition of AI App Development")
     * Use: "Banking Functions Enhanced by AI at NatWest" (NOT "Benefits of AI App Development")
     * Use: "The Impact of AI on NatWest's Operations" (NOT "How AI App Development Works")
   - Example: If title is "Data breach at Company X":
     * Use: "Understanding the Data Breach Incident" (NOT "Definition of AI App Development")
     * Use: "How the Breach Occurred" (NOT "Benefits of AI App Development")
   - DO NOT use generic headings like "Definition of AI App Development", "Benefits of AI App Development" unless the title is specifically about generic AI app development
   - Include primary keywords naturally in 2-3 headings

3. **PARAGRAPHS MUST MATCH THE SPECIFIC TOPIC**:
   - Every paragraph must be about "${item.title}"
   - If the title mentions "NatWest" and "banking", write about NatWest's banking AI implementation
   - If the title mentions a specific company, write about that company's specific situation
   - If the title mentions a specific event, write about that event
   - DO NOT write generic paragraphs about "AI app development" unless the title is specifically about generic AI app development
   - Use the article content as context to understand what "${item.title}" is about, then write original content about that specific topic
   - Use primary keyword naturally throughout (12-32 times in 1200-1600 words)

4. **SEO REQUIREMENTS**:
   - Include 4-6 strategic links: internal links (<a href="/automation">automation services</a>) and external links (<a href="https://example.com">credible source</a>) with natural anchor text
   - Use primary keyword in first 100 words
   - Include long-tail keyword variations naturally (2-3 times each)
   - DO NOT include "Meta Title", "Meta Description", or "Topics" sections - these are handled separately

5. **CONTENT STRUCTURE**:
   - Introduction: Explain what "${item.title}" is about and why it matters
   - Body sections: Discuss specific aspects related to "${item.title}" (not generic AI app development)
   - Conclusion: Summarize the implications of "${item.title}"

Important: Focus on why this news matters, not just what happened and avoid marketing speak or SEO padding - look like human written content. Keep it clear, insightful, and relevant to people who care about Mobile apps, Technology, innovative software.`,
      },
      {
        role: "user",
        content: `RSS Article:
Title: ${item.title}
URL: ${item.link || 'N/A'}
Content: ${articleContent.slice(0, 5000) || item.contentSnippet || item.content || 'No content available'}

🚨 CRITICAL: Write a blog post about "${item.title}". 

YOU MUST WRITE ABOUT THE EXACT TOPIC IN THE TITLE - not generic content.

**TOPIC-SPECIFIC REQUIREMENTS:**
- Extract the specific topic, company, event, or subject from "${item.title}"
- If the title mentions a specific company (e.g., "NatWest", "OpenAI", "Google"), write about that company's specific situation
- If the title mentions a specific event (e.g., "data breach", "merger", "launch"), write about that specific event
- If the title mentions a specific technology/product (e.g., "AI video generator", "gaming mouse"), write about that specific technology/product
- Create headings that match the specific topic in "${item.title}" - NOT generic headings
- Every paragraph must be about the specific topic in "${item.title}"

**HEADING EXAMPLES:**
- If title is "Banking AI at NatWest" → Use "NatWest's Banking AI Strategy" (NOT "What is AI App Development?")
- If title is "Data breach at Company X" → Use "Understanding the Data Breach at Company X" (NOT "Benefits of AI")
- If title is "New AI Video Generator" → Use "How the New AI Video Generator Works" (NOT "What is AI App Development?")
- If title is generic "AI App Development" → Then use generic headings

**DO NOT:**
- Write generic "AI App Development" content unless the title is specifically about generic AI app development
- Use generic headings like "What is AI App Development?" unless the title is about generic AI app development
- Write about topics not mentioned in "${item.title}"

Use the article content above as context to understand what "${item.title}" is about, then write original, insightful content about that specific topic.

Focus on why this news matters, not just what happened.`,
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
