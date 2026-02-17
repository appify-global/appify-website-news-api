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
 * Extract key entities from a title using OpenAI for semantic understanding
 * Returns both primary entity (usually company name) and all key entities
 */
async function extractEntities(title: string): Promise<{
  primaryEntity: string | null;
  keyEntities: string[];
}> {
  console.log(`[OpenAI] Extracting entities from title: ${title}`);
  
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2, // Low temperature for consistent extraction
    max_tokens: 300,
    messages: [
      {
        role: "system",
        content: `You are an entity extraction system. Extract key entities from a news article title.

Extract:
1. PRIMARY_ENTITY: The main company, organization, or product name (usually the first proper noun)
2. KEY_ENTITIES: Important names, products, technologies, concepts, actions, or phrases (4-8 entities)

Include:
- Company/organization names (e.g., "Debenhams", "Valve", "OpenAI")
- Product names (e.g., "Steam Deck OLED", "PayPal")
- Technologies/concepts (e.g., "Agentic AI", "AI Commerce", "RAM crisis")
- Actions/events (e.g., "pilot program", "integration", "stock shortage")
- Important phrases (e.g., "supply chain", "out of stock")

Exclude:
- Common words (the, a, an, and, or, but, in, on, at, to, for, of, with, by, via, from)
- Question words (How, Why, What, When, Where, Who, Which)
- Generic verbs (is, are, be, will, can)

OUTPUT FORMAT (JSON only, no other text):
{
  "primaryEntity": "Company or product name",
  "keyEntities": ["Entity1", "Entity2", "Entity3", ...]
}

Example for "Debenhams pilots agentic AI commerce via PayPal integration":
{
  "primaryEntity": "Debenhams",
  "keyEntities": ["Debenhams", "Agentic AI", "AI Commerce", "PayPal", "PayPal Integration", "Pilot Program"]
}

Example for "Valve's Steam Deck OLED will be 'intermittently' out of stock because of the RAM crisis":
{
  "primaryEntity": "Valve",
  "keyEntities": ["Valve", "Steam Deck OLED", "RAM Crisis", "Stock Shortage", "Supply Chain", "Gaming Hardware"]
}

Return ONLY valid JSON, nothing else.`,
      },
      {
        role: "user",
        content: `Extract entities from this title: "${title}"`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content || "";
  
  try {
    // Extract JSON from response (might have markdown code blocks)
    let jsonText = content.trim();
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const result = JSON.parse(jsonText);
    
    const primaryEntity = result.primaryEntity || null;
    let keyEntities = Array.isArray(result.keyEntities) ? result.keyEntities : [];
    
    // Ensure primary entity is in key entities if it exists
    if (primaryEntity && !keyEntities.includes(primaryEntity)) {
      keyEntities = [primaryEntity, ...keyEntities];
    }
    
    // Limit to 6 entities
    keyEntities = keyEntities.slice(0, 6);
    
    console.log(`[OpenAI] Extracted PRIMARY_ENTITY: ${primaryEntity || 'None'}`);
    console.log(`[OpenAI] Extracted KEY_ENTITIES: ${keyEntities.join(', ')}`);
    
    return {
      primaryEntity,
      keyEntities
    };
  } catch (error: any) {
    console.warn(`[OpenAI] Failed to parse entity extraction JSON: ${error.message}`);
    console.warn(`[OpenAI] Raw response: ${content}`);
    
    // Fallback to code-based extraction
    return extractEntitiesFallback(title);
  }
}

/**
 * Fallback code-based entity extraction (used if OpenAI fails)
 */
function extractEntitiesFallback(title: string): {
  primaryEntity: string | null;
  keyEntities: string[];
} {
  console.log(`[OpenAI] Using fallback code-based extraction`);
  
  const entities: string[] = [];
  const allCaps = title.match(/\b[A-Z]{2,}\b/g) || [];
  entities.push(...allCaps);
  
  const multiCaps = title.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g) || [];
  entities.push(...multiCaps);
  
  const singleCaps = title.match(/\b[A-Z][a-z]+\b/g) || [];
  entities.push(...singleCaps);
  
  const stopCaps = ["Can", "Will", "How", "Why", "When", "What", "Where", "Who", "Which", "This", "That", "These", "Those", "The", "A", "An"];
  const commonWords = ["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "is", "are", "be", "via", "from"];
  
  const cleaned = [...new Set(entities)]
    .filter(e => !commonWords.includes(e.toLowerCase()))
    .filter(e => !stopCaps.includes(e))
    .filter(e => e.length > 1);
  
  const primaryMatch = title.match(/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/);
  let primaryEntity = primaryMatch ? primaryMatch[0] : null;
  
  if (primaryEntity && stopCaps.includes(primaryEntity)) {
    const nextMatch = title.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
    if (nextMatch && nextMatch.length > 1) {
      primaryEntity = nextMatch[1];
    } else {
      primaryEntity = null;
    }
  }
  
  const finalEntities = primaryEntity
    ? [primaryEntity, ...cleaned.filter(e => e !== primaryEntity && !e.toLowerCase().includes(primaryEntity.toLowerCase()))]
    : cleaned;
  
  return {
    primaryEntity,
    keyEntities: finalEntities.slice(0, 6)
  };
}

/**
 * Generate article outline first - ensures headings match the RSS article
 */
async function generateArticleOutline(
  item: RSSItem, 
  primaryEntity: string | null, 
  keyEntities: string[],
  articleContent: string
): Promise<string> {
  console.log(`[OpenAI] Generating article outline for: ${item.title}`);
  
  const primaryTopic = item.title;
  
  // Extract action from title
  const actionMatch = item.title.match(/\b(pilots?|launches?|integrates?|acquires?|tests?|announces?|will be|is|are|out of stock|shortage|crisis)\b/i);
  const titleAction = actionMatch ? actionMatch[1] : 'action';

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.3, // Lower temperature for more structured output
    max_tokens: 500,
    messages: [
      {
        role: "system",
        content: `You are creating an article outline for a technology news blog.

RSS TITLE: "${primaryTopic}"
PRIMARY_ENTITY: "${primaryEntity || primaryTopic}"
KEY_ENTITIES: ${keyEntities.join(', ')}
TITLE ACTION: "${titleAction}"

CRITICAL REQUIREMENTS:
1. Generate 4-6 H2 headings that MUST include PRIMARY_ENTITY "${primaryEntity || primaryTopic}" in at least 3 headings
2. Each heading must relate to the SPECIFIC NEWS STORY in the title, not generic topics
3. Headings must discuss the ACTION: "${titleAction}"
4. FORBIDDEN: Generic headings like "Understanding AI", "Benefits of AI App Development", "AI App Development Strategies", "The Future of AI in App Development"

OUTPUT FORMAT:
Return ONLY a numbered list of headings in this exact format:
1. <h2>HEADING TEXT HERE</h2>
2. <h2>HEADING TEXT HERE</h2>
3. <h2>HEADING TEXT HERE</h2>
...

Each heading must:
- Include PRIMARY_ENTITY or a KEY_ENTITY
- Be specific to the news story
- NOT be generic AI content

Example for "Debenhams pilots agentic AI commerce via PayPal integration":
1. <h2>DEBENHAMS' AGENTIC AI COMMERCE PILOT PROGRAM</h2>
2. <h2>PAYPAL INTEGRATION IN DEBENHAMS' CHECKOUT STRATEGY</h2>
3. <h2>HOW DEBENHAMS IS TESTING AGENTIC AI IN RETAIL</h2>
4. <h2>THE IMPACT OF DEBENHAMS' AI COMMERCE INITIATIVE</h2>

Example for "Valve's Steam Deck OLED will be intermittently out of stock":
1. <h2>VALVE'S STEAM DECK OLED STOCK SHORTAGE</h2>
2. <h2>THE RAM CRISIS IMPACTING STEAM DECK SUPPLY CHAINS</h2>
3. <h2>HOW VALVE IS MANAGING INTERMITTENT STOCK AVAILABILITY</h2>
4. <h2>THE SUPPLY CHAIN CHALLENGES AFFECTING GAMING HARDWARE</h2>

Return ONLY the numbered list, nothing else.`,
      },
      {
        role: "user",
        content: `RSS Article:
Title: ${item.title}
Content: ${articleContent.slice(0, 1500)}

Generate the article outline with headings that match this specific news story.`,
      },
    ],
  });

  let outline = response.choices[0]?.message?.content || "";
  
  // Validate outline
  if (primaryEntity) {
    const entityCount = (outline.match(new RegExp(primaryEntity, 'gi')) || []).length;
    if (entityCount < 3) {
      console.warn(`[OpenAI] Outline validation: PRIMARY_ENTITY "${primaryEntity}" appears only ${entityCount} times. Regenerating...`);
      // Retry once with stronger enforcement
      const retryResponse = await getOpenAI().chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 500,
        messages: [
          {
            role: "system",
            content: `CRITICAL: The previous outline was rejected because PRIMARY_ENTITY "${primaryEntity}" did not appear in enough headings.

You MUST create an outline where "${primaryEntity}" appears in at least 3 headings.

RSS TITLE: "${primaryTopic}"
PRIMARY_ENTITY: "${primaryEntity}"
KEY_ENTITIES: ${keyEntities.join(', ')}

Generate 4-6 headings where "${primaryEntity}" is in at least 3 headings.

Format: Numbered list with <h2> tags.
FORBIDDEN: Generic AI headings.`,
          },
          {
            role: "user",
            content: `Title: ${item.title}\n\nGenerate outline with "${primaryEntity}" in at least 3 headings.`,
          },
        ],
      });
      outline = retryResponse.choices[0]?.message?.content || outline;
    }
  }
  
  console.log(`[OpenAI] Generated outline:\n${outline}`);
  return outline;
}

export async function generateBlogContent(item: RSSItem): Promise<string> {
  console.log(`[OpenAI] Generating blog for: ${item.title}`);

  // Extract key entities from title using OpenAI
  const { primaryEntity, keyEntities } = await extractEntities(item.title);
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

  // STEP 1: Generate outline first
  let outline = await generateArticleOutline(item, primaryEntity, finalKeyEntities, articleContent);
  
  // Extract headings from outline
  let headingMatches = outline.match(/<h2[^>]*>(.+?)<\/h2>/gi) || [];
  const headings = headingMatches.map(h => h.replace(/<\/?h2[^>]*>/gi, '').trim());
  
  // Validate outline doesn't contain generic AI headings
  const genericPatterns = ['ai app development', 'understanding ai', 'benefits of ai', 'future of ai in app'];
  const hasGenericHeadings = headings.some(h => 
    genericPatterns.some(pattern => h.toLowerCase().includes(pattern))
  );
  
  if (hasGenericHeadings) {
    console.warn(`[OpenAI] Outline contains generic AI headings! Regenerating outline...`);
    // Regenerate outline with stronger enforcement
    const retryOutline = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content: `CRITICAL: The previous outline was rejected for containing generic AI headings.

You MUST create headings about the SPECIFIC NEWS STORY: "${primaryTopic}"

PRIMARY_ENTITY: "${primaryEntity || primaryTopic}"
KEY_ENTITIES: ${finalKeyEntities.join(', ')}

FORBIDDEN HEADINGS:
- "AI App Development"
- "Understanding AI"
- "Benefits of AI"
- "The Future of AI in App Development"
- Any generic AI topic

REQUIRED: Headings must be about "${primaryEntity || 'the company'}" and the specific news story.

Generate 4-6 specific headings about the news story.`,
        },
        {
          role: "user",
          content: `Title: ${item.title}\n\nGenerate specific headings about this news story, NOT generic AI topics.`,
        },
      ],
    });
    const newOutline = retryOutline.choices[0]?.message?.content || outline;
    const newHeadingMatches = newOutline.match(/<h2[^>]*>(.+?)<\/h2>/gi) || [];
    if (newHeadingMatches.length > 0) {
      outline = newOutline;
      headingMatches = newHeadingMatches;
    }
  }
  
  if (headingMatches.length === 0) {
    console.warn(`[OpenAI] No headings found in outline, falling back to direct generation`);
  } else {
    const finalHeadings = headingMatches.map(h => h.replace(/<\/?h2[^>]*>/gi, '').trim());
    console.log(`[OpenAI] Using outline with ${finalHeadings.length} headings: ${finalHeadings.slice(0, 3).join(', ')}...`);
  }

  // STEP 2: Write the full article following the outline
  // Extract heading text for validation
  const outlineHeadings = headings.map(h => h.replace(/<\/?h2[^>]*>/gi, '').trim());
  
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.4,
    max_tokens: 2500,
    messages: [
      {
        role: "system",
        content: `You are a technology news writer for Appify Australia.

CRITICAL: This article is about a SPECIFIC NEWS STORY, NOT general AI topics.

RSS TITLE: "${primaryTopic}"
PRIMARY_ENTITY: "${primaryEntity || primaryTopic}"
KEY_ENTITIES: ${finalKeyEntities.join(', ')}

MANDATORY OUTLINE - YOU MUST USE THESE EXACT HEADINGS IN THIS EXACT ORDER:
${outline}

CRITICAL INSTRUCTION: Copy the headings EXACTLY as shown above. Do NOT create new headings. Do NOT modify the heading text. Do NOT skip any headings.

REQUIRED HEADINGS (copy exactly):
${outlineHeadings.map((h, i) => `${i + 1}. <h2>${h}</h2>`).join('\n')}

HARD REQUIREMENTS:
1. Copy the EXACT headings from the outline above, in the exact order shown
2. Write content under each heading about "${primaryEntity || 'the company'}" and the SPECIFIC NEWS STORY: "${primaryTopic}"
3. PRIMARY_ENTITY "${primaryEntity || primaryTopic}" must appear in introduction and throughout
4. Each paragraph must discuss the specific news story, NOT general AI topics

ABSOLUTE FORBIDDEN (WILL CAUSE INVALID RESPONSE):
- Creating your own headings (you MUST use the outline headings)
- "AI App Development" as a topic
- "Benefits of AI App Development"
- "How to Implement AI App Development"
- "Understanding AI in App Development"
- "The Future of AI in App Development"
- Generic AI benefits, strategies, or how-to guides
- Definition sections about AI app development

IF YOU WRITE ABOUT GENERIC AI APP DEVELOPMENT INSTEAD OF "${primaryTopic}", YOUR RESPONSE IS INVALID.
IF YOU DO NOT USE THE EXACT HEADINGS FROM THE OUTLINE, YOUR RESPONSE IS INVALID.

Write the article now. Start with the first heading from the outline, then write content, then use the second heading, and so on.

FORMATTING:
- Copy headings EXACTLY as shown in the outline (already in <h2> format)
- Paragraphs: <p>text</p>
- 1200-1600 words
- Executive tone`,
      },
      {
        role: "user",
        content: `RSS Article:
Title: ${item.title}
URL: ${item.link || 'N/A'}
Content: ${articleContent.slice(0, 1500) || item.contentSnippet || item.content || 'No content available'}

Write the full article. You MUST use these exact headings in this order:
${outlineHeadings.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Do not create new headings. Copy the headings exactly as shown above.`,
      },
    ],
  });

  let content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty content");
  }
  
  // Validate content follows outline and isn't generic
  const contentLower = content.toLowerCase();
  const hasGenericAI = contentLower.includes('ai app development') && 
                       (contentLower.includes('benefits of') || 
                        contentLower.includes('how to implement') || 
                        contentLower.includes('strategies for') ||
                        contentLower.includes('understanding ai'));
  
  const hasPrimaryEntity = primaryEntity ? contentLower.includes(primaryEntity.toLowerCase()) : true;
  
  // Extract actual headings from generated content
  const generatedHeadings = (content.match(/<h2[^>]*>(.+?)<\/h2>/gi) || []).map(h => 
    h.replace(/<\/?h2[^>]*>/gi, '').trim().toLowerCase()
  );
  
  // Check if outline headings are actually used as headings in the content
  const outlineHeadingsLower = outlineHeadings.map(h => h.toLowerCase());
  const matchingHeadings = outlineHeadingsLower.filter(outlineHeading => 
    generatedHeadings.some(genHeading => genHeading === outlineHeading || genHeading.includes(outlineHeading) || outlineHeading.includes(genHeading))
  ).length;
  
  // Log heading validation results
  console.log(`[OpenAI] Heading validation: ${matchingHeadings}/${outlineHeadings.length} outline headings found in generated content`);
  if (matchingHeadings === outlineHeadings.length) {
    console.log(`[OpenAI] ✅ All outline headings used correctly`);
  } else if (matchingHeadings >= outlineHeadings.length * 0.7) {
    console.log(`[OpenAI] ⚠️  Some outline headings missing, but above threshold (70%)`);
  }
  
  // If content is generic or doesn't follow outline, regenerate
  if (hasGenericAI || !hasPrimaryEntity || matchingHeadings < outlineHeadings.length * 0.7) {
    console.warn(`[OpenAI] Content validation failed. Generic AI: ${hasGenericAI}, Has Entity: ${hasPrimaryEntity}, Outline Match: ${matchingHeadings}/${outlineHeadings.length}. Generated headings: ${generatedHeadings.slice(0, 3).join(', ')}... Regenerating...`);
    
    // Regenerate with even stronger enforcement
    const retryResponse = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 2500,
      messages: [
        {
          role: "system",
          content: `CRITICAL: The previous article was rejected for being generic or not following the outline.

You MUST write about the SPECIFIC NEWS STORY: "${primaryTopic}"

PRIMARY_ENTITY: "${primaryEntity || primaryTopic}"
KEY_ENTITIES: ${finalKeyEntities.join(', ')}

MANDATORY OUTLINE - COPY THESE EXACT HEADINGS:
${outline}

REQUIRED HEADINGS (copy exactly, in this order):
${outlineHeadings.map((h, i) => `${i + 1}. <h2>${h}</h2>`).join('\n')}

ABSOLUTE REQUIREMENTS:
1. Copy the EXACT headings from the outline above, in the exact order shown
2. Do NOT create new headings - only use the headings from the outline
3. Write about "${primaryEntity || 'the company'}" and the specific news story
4. FORBIDDEN: "AI App Development", "Benefits of AI", "How to Implement AI", generic AI content
5. The article is about "${primaryTopic}", NOT general AI topics

If you write generic AI content or create your own headings, your response is INVALID.`,
        },
        {
          role: "user",
          content: `Title: ${item.title}
URL: ${item.link || 'N/A'}
Content: ${articleContent.slice(0, 1500) || item.contentSnippet || item.content || 'No content available'}

Write the article. You MUST use these exact headings in this order:
${outlineHeadings.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Copy the headings exactly. Do not create new headings. Write about ${primaryEntity || 'the company'} and the specific news story, NOT generic AI topics.`,
        },
      ],
    });
    
    content = retryResponse.choices[0]?.message?.content || content;
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
  // Check for HTML headings first, then markdown, then plain text
  const firstHtmlHeading = content.search(/^<h2[^>]*>/im);
  const firstMarkdownHeading = content.search(/^##\s+/m);
  const firstParagraph = content.search(/^<p[^>]*>|^[A-Z]/im);
  const startIndex = firstHtmlHeading !== -1 ? firstHtmlHeading : 
                     (firstMarkdownHeading !== -1 ? firstMarkdownHeading : 
                      (firstParagraph !== -1 ? firstParagraph : 0));
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
    // Check for HTML headings
    const htmlHeadingMatch = line.match(/^<h2[^>]*>(.+?)<\/h2>/i);
    // Check for markdown headings (fallback)
    const markdownHeadingMatch = line.match(/^##\s+(.+)$/);
    
    if (htmlHeadingMatch || markdownHeadingMatch) {
      const headingText = (htmlHeadingMatch ? htmlHeadingMatch[1] : markdownHeadingMatch![1]).trim().toLowerCase();
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
  content = content.replace(/<h2[^>]*>\s*Conclusion\s*<\/h2>[\s\S]*$/gim, "");
  
  // Ensure all headings have proper HTML format
  // Fix headings that are ALL CAPS without HTML tags
  const contentLines = content.split('\n');
  const fixedLines: string[] = [];
  
  for (let i = 0; i < contentLines.length; i++) {
    const line = contentLines[i];
    const trimmed = line.trim();
    
    // Check if this looks like a heading (ALL CAPS, no HTML/markdown prefix, on its own line)
    if (trimmed && 
        trimmed === trimmed.toUpperCase() && 
        trimmed.length > 10 && 
        trimmed.length < 100 &&
        !trimmed.match(/^<h[23][^>]*>/) &&
        !trimmed.match(/^##\s+/) &&
        !trimmed.match(/^###\s+/) &&
        (i === 0 || contentLines[i-1].trim() === '') &&
        (i === contentLines.length - 1 || contentLines[i+1].trim() === '' || contentLines[i+1].trim().match(/^<p|^[A-Z]/i))) {
      // Convert to HTML heading
      fixedLines.push(`<h2>${trimmed}</h2>`);
    } else {
      fixedLines.push(line);
    }
  }
  
  content = fixedLines.join('\n');
  
  // Clean up extra whitespace
  content = content.trim();

  console.log(`[OpenAI] Generated ${content.split(" ").length} words.`);
  return content;
}
