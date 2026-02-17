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
/**
 * Extract key entities from a title dynamically with PRIMARY_ENTITY detection
 * This makes the system universal - works for any article title
 * Returns both primary entity (usually company name) and all key entities
 */
function extractEntities(title: string): {
  primaryEntity: string | null;
  keyEntities: string[];
} {
  const entities: string[] = [];

  // 1️⃣ Detect ALL CAPS acronyms (SRPO, GRPO, LLM, API)
  const allCaps = title.match(/\b[A-Z]{2,}\b/g) || [];
  entities.push(...allCaps);

  // 2️⃣ Detect multi-word capitalized phrases (Copilot Studio, Kwai AI)
  const multiCaps = title.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || [];
  entities.push(...multiCaps);

  // 3️⃣ Detect single capitalized proper nouns (Debenhams, Microsoft)
  const singleCaps = title.match(/\b[A-Z][a-z]+\b/g) || [];
  entities.push(...singleCaps);

  // 4️⃣ Detect compound AI phrases (agentic AI, AI commerce, PayPal integration)
  const compoundPhrases =
    title.match(/\b([a-z]+ AI|AI [a-z]+|[A-Z][a-z]+ integration|AI commerce|AI platform|AI model)\b/gi) || [];
  // Capitalize properly
  const capitalizedPhrases = compoundPhrases.map(phrase => {
    return phrase.split(/\s+/).map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  });
  entities.push(...capitalizedPhrases);

  // 5️⃣ Detect financial / performance claims (10x, $500M, 20%)
  const metrics = title.match(/\d+x|\$\d+(?:M|B)?|\d+%/gi) || [];
  entities.push(...metrics);

  // 6️⃣ Extract quoted phrases
  const quoted = title.match(/"([^"]+)"/g) || [];
  entities.push(...quoted.map(q => q.replace(/"/g, '')));

  // 7️⃣ Extract hyphenated names
  const hyphenated = title.match(/\b[A-Z][a-z]+-[A-Z][a-z]+/g) || [];
  entities.push(...hyphenated);

  // 8️⃣ Clean stopwords
  const stopCaps = [
    "Can", "Will", "How", "Why", "When", "What", "Where",
    "Who", "Which", "This", "That", "These", "Those",
    "The", "A", "An"
  ];

  const commonWords = [
    "the", "a", "an", "and", "or", "but", "in", "on", "at",
    "to", "for", "of", "with", "by", "is", "are", "be",
    "via", "from"
  ];

  const cleaned = [...new Set(entities)]
    .filter(e => !commonWords.includes(e.toLowerCase()))
    .filter(e => !stopCaps.includes(e))
    .filter(e => e.length > 1);

  // 9️⃣ Detect PRIMARY_ENTITY (first strong capitalized brand name)
  const primaryMatch = title.match(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/);
  let primaryEntity = primaryMatch ? primaryMatch[0] : null;
  
  // Validate primary entity is not a stopword
  if (primaryEntity && stopCaps.includes(primaryEntity)) {
    // Try to find next capitalized word
    const nextMatch = title.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
    if (nextMatch && nextMatch.length > 1) {
      primaryEntity = nextMatch[1];
    } else {
      primaryEntity = null;
    }
  }

  // 🔟 Prioritize primary entity first
  const finalEntities = primaryEntity
    ? [primaryEntity, ...cleaned.filter(e => e !== primaryEntity && !e.toLowerCase().includes(primaryEntity.toLowerCase()))]
    : cleaned;

  return {
    primaryEntity,
    keyEntities: finalEntities.slice(0, 6)
  };
}

export async function generateBlogContent(item: RSSItem): Promise<string> {
  console.log(`[OpenAI] Generating blog for: ${item.title}`);

  // Extract key entities from title dynamically
  const { primaryEntity, keyEntities } = extractEntities(item.title);
  const primaryTopic = item.title;
  
  // Fallback: If we have less than 2 entities, add primary topic as context
  let finalKeyEntities = keyEntities;
  if (keyEntities.length < 2) {
    console.log(`[OpenAI] Warning: Only ${keyEntities.length} entities extracted. Adding primary topic as fallback.`);
    finalKeyEntities = [...keyEntities, primaryTopic];
  }
  
  console.log(`[OpenAI] Extracted entities: ${finalKeyEntities.join(', ')}`);
  if (primaryEntity) {
    console.log(`[OpenAI] Primary entity: ${primaryEntity}`);
  }

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
    temperature: 0.4, // Lower temperature for controlled variance, less drift
    max_tokens: 2500,
    messages: [
      {
        role: "system",
        content: `You are a senior AI industry analyst writing for Appify Australia.

Your task is to rewrite the provided RSS article into an original, SEO-optimized thought-leadership blog strictly focused on the RSS title.

PRIMARY_TOPIC: "${primaryTopic}"
PRIMARY_ENTITY: "${primaryEntity || primaryTopic}"
KEY_ENTITIES: ${finalKeyEntities.length > 0 ? finalKeyEntities.join(', ') : '[Extract from title]'}

ENTITY ANCHORING RULES:

1. Before writing the full article, internally generate a structured H2 outline using KEY_ENTITIES. Ensure each H2 includes at least one KEY_ENTITY.
2. PRIMARY_ENTITY "${primaryEntity || primaryTopic}" MUST appear in at least 3 H2 headings.
3. PRIMARY_ENTITY "${primaryEntity || primaryTopic}" MUST appear in the introduction.
4. At least 70% of paragraphs must reference a KEY_ENTITY.
5. The introduction must reference at least two KEY_ENTITIES within the first 120 words.
6. The article must remain strictly within the scope of PRIMARY_TOPIC.
7. If PRIMARY_ENTITY does not appear in at least 3 H2 headings, rewrite the article before completing.

FORBIDDEN:
- Generic "AI app development" filler.
- Generic headings like "Understanding AI", "Benefits of AI App Development".
- Standalone definition sections unless directly tied to KEY_ENTITIES.
- Content unrelated to PRIMARY_TOPIC.
- Headings that don't mention PRIMARY_ENTITY or other KEY_ENTITIES.

SEO REQUIREMENTS:
- 1200-1600 words.
- Executive, analytical tone.
- Include 4-6 contextual links (internal: /automation, /projects, /studio; plus credible external sources).
- No meta sections or keyword lists.

If the article drifts from PRIMARY_TOPIC or becomes generic, correct it before finishing.`,
      },
      {
        role: "user",
        content: `RSS Article:
Title: ${item.title}
URL: ${item.link || 'N/A'}
Content: ${articleContent.slice(0, 5000) || item.contentSnippet || item.content || 'No content available'}

Write the final article now.`,
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
