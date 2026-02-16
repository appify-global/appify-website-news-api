/**
 * Code-based SEO optimization.
 * Extracts keywords, adds internal/external links, and structures content.
 */

interface SEOResult {
  optimizedContent: string;
  metaTitle: string;
  metaDescription: string;
  topics: string;
  primaryKeyword?: string;
}

// Comprehensive keyword list for SEO dominance (15-20 keywords)
// Primary keywords (high volume, competitive)
const PRIMARY_KEYWORDS = [
  "app development",
  "AI app development",
  "AI agent",
  "AI software",
  "artificial intelligence software",
  "mobile app developers",
  "custom software development",
  "app developers Australia",
  "software development",
  "digital transformation",
  "mobile applications",
  "workforce automation",
  "workplace automation",
];

// Long-tail keywords (lower volume, easier to rank)
const LONG_TAIL_KEYWORDS = [
  "how to build AI apps in Australia",
  "what is AI app development",
  "AI app development vs traditional app development",
  "best AI app developers Melbourne",
  "custom mobile app development services",
  "enterprise app development solutions",
  "AI-powered mobile applications",
  "app development for startups",
  "digital transformation through apps",
  "how does AI app development work",
  "what are the benefits of AI in app development",
  "when should you use AI in mobile apps",
  "AI app developers Sydney",
  "app development company Melbourne",
  "what is an AI agent",
  "how do AI agents work",
  "AI agent technology",
  "autonomous AI agents",
  "AI software solutions",
  "AI software platform",
  "workforce automation solutions",
  "business automation software",
];

// Combine all keywords
const KEYWORDS = [...PRIMARY_KEYWORDS, ...LONG_TAIL_KEYWORDS];

// Internal links mapping
const INTERNAL_LINKS: Record<string, string> = {
  automation: "/automation",
  seo: "/automation/seo",
  phone: "/automation/phone",
  projects: "/projects",
  studio: "/studio",
};

/**
 * Extract keywords from content
 */
function extractKeywords(content: string): string[] {
  const found: string[] = [];
  const lowerContent = content.toLowerCase();

  for (const keyword of KEYWORDS) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      found.push(keyword);
    }
  }

  return found.slice(0, 20); // Return up to 20 keywords (primary + long-tail)
}

/**
 * Get semantic variations and LSI keywords for the primary keyword
 */
function getSemanticKeywords(primaryKeyword: string): string[] {
  const semanticMap: Record<string, string[]> = {
    'ai agent': ['AI assistant', 'intelligent agent', 'autonomous agent', 'AI automation', 'agent technology'],
    'ai software': ['artificial intelligence platform', 'AI solution', 'machine learning software', 'AI system', 'intelligent software'],
    'digital transformation': ['digital strategy', 'digital innovation', 'digital adoption', 'business transformation', 'digital modernization'],
    'workforce automation': ['workplace automation', 'business automation', 'process automation', 'task automation', 'operational automation'],
    'app development': ['application development', 'mobile app development', 'software development', 'app creation', 'application engineering']
  };
  
  const keywordLower = primaryKeyword.toLowerCase();
  return semanticMap[keywordLower] || [];
}

/**
 * Strategically integrate primary keyword into content without oversaturation
 * Places keyword in: first 100 words, 2-3 H2 headings, conclusion
 */
function integratePrimaryKeyword(
  content: string,
  primaryKeyword: string,
  targetCount: number = 3
): string {
  const keywordLower = primaryKeyword.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // Count current occurrences
  const keywordRegex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  const currentCount = (contentLower.match(keywordRegex) || []).length;
  
  if (currentCount >= targetCount) {
    return content; // Already has enough
  }
  
  const needed = targetCount - currentCount;
  let optimized = content;
  let added = 0;
  
  // Strategy 1: Ensure keyword in first 100 words if missing
  const first100Words = optimized.split(/\s+/).slice(0, 100).join(" ");
  if (!first100Words.toLowerCase().includes(keywordLower) && added < needed) {
    // Find first paragraph and add keyword naturally
    const firstParagraphMatch = optimized.match(/^(.*?)(\n\n|$)/m);
    if (firstParagraphMatch && firstParagraphMatch[1].length > 50) {
      const firstPara = firstParagraphMatch[1];
      // Add keyword variation naturally at the end of first paragraph
      const variations = [
        `${primaryKeyword} represents`,
        `the ${primaryKeyword} landscape`,
        `${primaryKeyword} solutions`,
        `implementing ${primaryKeyword}`
      ];
      const variation = variations.find(v => !firstPara.toLowerCase().includes(v.toLowerCase()));
      if (variation) {
        optimized = optimized.replace(
          firstParagraphMatch[0],
          `${firstPara}. Understanding ${variation} is crucial for businesses seeking competitive advantage.${firstParagraphMatch[2] || ''}`
        );
        added++;
      }
    }
  }
  
  // Strategy 2: Add to H2 headings (if keyword not already there and heading is relevant)
  if (added < needed) {
    const h2Pattern = /(##\s+)([^\n]+)/g;
    optimized = optimized.replace(h2Pattern, (match, prefix, heading) => {
      if (added >= needed) return match;
      if (!heading.toLowerCase().includes(keywordLower)) {
        // Only add to non-generic headings
        const genericHeadings = ['introduction', 'conclusion', 'summary', 'overview', 'key takeaways'];
        const isGeneric = genericHeadings.some(g => heading.toLowerCase().includes(g));
        
        if (!isGeneric && heading.length > 10) {
          // Add keyword variation to heading if it makes sense
          const keywordVariations: Record<string, string[]> = {
            'ai agent': ['AI Agent', 'AI Agents', 'AI Agent Technology'],
            'ai software': ['AI Software', 'AI Software Solutions', 'AI Software Platform'],
            'digital transformation': ['Digital Transformation', 'Digital Transformation Strategy'],
            'workforce automation': ['Workforce Automation', 'Workforce Automation Solutions'],
            'app development': ['App Development', 'Application Development', 'App Development Services']
          };
          
          // Don't modify headings - keep them clean without adding ": Insights" suffix
          // This was causing headings like "What Is X?: Y Insights" which is grammatically incorrect
          // Just return the original heading unchanged
          return match;
        }
      }
      return match;
    });
  }
  
  // Strategy 3: Add to conclusion section if needed
  if (added < needed) {
    const conclusionMatch = optimized.match(/##\s+(Summary|Conclusion|Final Thoughts|Strategic Outlook)[^\n]*\n\n(.*?)(?=\n\n##|$)/is);
    if (conclusionMatch && !conclusionMatch[2].toLowerCase().includes(keywordLower)) {
      const conclusionText = conclusionMatch[2];
      optimized = optimized.replace(
        conclusionMatch[0],
        `${conclusionMatch[1]}\n\n${conclusionText}\n\nAs organizations continue to explore ${primaryKeyword.toLowerCase()} solutions, staying informed about best practices and implementation strategies becomes essential for long-term success.`
      );
      added++;
    }
  }
  
  return optimized;
}

/**
 * Naturally integrate semantic keywords throughout content
 */
function integrateSemanticKeywords(content: string, primaryKeyword: string): string {
  const semanticKeywords = getSemanticKeywords(primaryKeyword);
  let optimized = content;
  
  // Replace some instances of primary keyword with semantic variations (max 30% replacement)
  semanticKeywords.slice(0, 2).forEach((semantic) => {
    const primaryRegex = new RegExp(`\\b${primaryKeyword}\\b`, 'gi');
    const matches = optimized.match(primaryRegex);
    const matchCount = matches ? matches.length : 0;
    
    // Only replace if we have more than 2 occurrences (to maintain natural flow)
    if (matchCount > 2) {
      let replaced = false;
      optimized = optimized.replace(primaryRegex, (match, offset) => {
        // Don't replace first occurrence or if in heading
        const beforeMatch = optimized.substring(Math.max(0, offset - 50), offset);
        if (!replaced && offset > 200 && !beforeMatch.includes('##')) {
          replaced = true;
          return semantic;
        }
        return match;
      });
    }
  });
  
  return optimized;
}

/**
 * Add strategic internal links to content (8-12 links for SEO)
 * IMPORTANT: Never add links to headings - they get used as titles!
 */
function addInternalLinks(content: string): string {
  let linkCount = 0;
  const maxLinks = 12; // Target 8-12 links

  // Track which links we've added to avoid duplicates
  const addedLinks = new Set<string>();

  // Split content into lines - process line by line to skip headings
  const lines = content.split('\n');
  const processedLines: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip headings - don't add links to them (they become titles!)
    if (trimmed.startsWith('## ') || trimmed.startsWith('### ') || trimmed.match(/^<h[23]/i)) {
      processedLines.push(line);
      continue;
    }
    
    // Process non-heading lines only
    let processedLine = line;
    const lineLower = processedLine.toLowerCase();
    
    // Only add links to body paragraphs, not headings
    if (lineLower.includes("automation") && !addedLinks.has("automation") && linkCount < maxLinks && !processedLine.includes('<a href')) {
      processedLine = processedLine.replace(
        /(\bautomation\b)/i,
        '<a href="/automation">$1</a>'
      );
      addedLinks.add("automation");
      linkCount++;
    }

    if (lineLower.includes("software development") && !addedLinks.has("software") && linkCount < maxLinks && !processedLine.includes('<a href')) {
      processedLine = processedLine.replace(
        /(\bsoftware development\b)/i,
        '<a href="/projects">$1</a>'
      );
      addedLinks.add("software");
      linkCount++;
    }

    if (lineLower.includes("app development") && !addedLinks.has("app-dev") && linkCount < maxLinks && !processedLine.includes('<a href')) {
      processedLine = processedLine.replace(
        /(\bapp development\b)/i,
        '<a href="/projects">$1</a>'
      );
      addedLinks.add("app-dev");
      linkCount++;
    }

    if (lineLower.includes("seo") && !addedLinks.has("seo") && linkCount < maxLinks && !processedLine.includes('<a href')) {
      processedLine = processedLine.replace(
        /(\bseo\b)/i,
        '<a href="/automation/seo">$1</a>'
      );
      addedLinks.add("seo");
      linkCount++;
    }

    if (lineLower.includes("phone automation") && !addedLinks.has("phone") && linkCount < maxLinks && !processedLine.includes('<a href')) {
      processedLine = processedLine.replace(
        /(\bphone automation\b)/i,
        '<a href="/automation/phone">$1</a>'
      );
      addedLinks.add("phone");
      linkCount++;
    }

    if (lineLower.includes("mobile app") && !addedLinks.has("mobile") && linkCount < maxLinks && !processedLine.includes('<a href')) {
      processedLine = processedLine.replace(
        /(\bmobile app\b)/i,
        '<a href="/projects">$1</a>'
      );
      addedLinks.add("mobile");
      linkCount++;
    }

    if (lineLower.includes("custom software") && !addedLinks.has("custom") && linkCount < maxLinks && !processedLine.includes('<a href')) {
      processedLine = processedLine.replace(
        /(\bcustom software\b)/i,
        '<a href="/projects">$1</a>'
      );
      addedLinks.add("custom");
      linkCount++;
    }

    if (lineLower.includes("digital transformation") && !addedLinks.has("digital") && linkCount < maxLinks && !processedLine.includes('<a href')) {
      processedLine = processedLine.replace(
        /(\bdigital transformation\b)/i,
        '<a href="/automation">$1</a>'
      );
      addedLinks.add("digital");
      linkCount++;
    }

    if (lineLower.includes("ai agent") && !addedLinks.has("ai-agent") && linkCount < maxLinks && !processedLine.includes('<a href')) {
      processedLine = processedLine.replace(
        /(\bai agent\b)/i,
        '<a href="/automation">$1</a>'
      );
      addedLinks.add("ai-agent");
      linkCount++;
    }

    if (lineLower.includes("ai software") && !addedLinks.has("ai-software") && linkCount < maxLinks && !processedLine.includes('<a href')) {
      processedLine = processedLine.replace(
        /(\bai software\b)/i,
        '<a href="/projects">$1</a>'
      );
      addedLinks.add("ai-software");
      linkCount++;
    }

    // Add studio link if relevant
    if ((lineLower.includes("design") || lineLower.includes("ui") || lineLower.includes("ux")) && !addedLinks.has("studio") && linkCount < maxLinks && !processedLine.includes('<a href')) {
      processedLine = processedLine.replace(
        /(\b(design|ui|ux)\b)/i,
        '<a href="/studio">$1</a>'
      );
      addedLinks.add("studio");
      linkCount++;
    }

    processedLines.push(processedLine);
  }

  return processedLines.join('\n');
}

/**
 * Determine topic from content and categories
 * Only returns topics from our allowed list: AI, Automation, Web, Startups, Defi, Web3, Work, Design, Culture
 */
function determineTopic(content: string, categories?: string[], rssTitle?: string): string {
  const lowerContent = content.toLowerCase();
  const lowerTitle = (rssTitle || "").toLowerCase();
  const combinedText = (lowerTitle + " " + lowerContent).toLowerCase();
  const categoryStr = categories?.join(" ").toLowerCase() || "";
  
  // Allowed topics (must match exactly)
  const allowedTopics = ["AI", "Automation", "Web", "Startups", "Defi", "Web3", "Work", "Design", "Culture"];
  
  const detectedTopics: string[] = [];
  
  // Check if RSS categories match any allowed topic
  if (categories && categories.length > 0) {
    for (const cat of categories) {
      const normalizedCat = cat.trim();
      if (allowedTopics.includes(normalizedCat)) {
        detectedTopics.push(normalizedCat);
      } else {
        // Check case-insensitive match
        const matched = allowedTopics.find(t => t.toLowerCase() === normalizedCat.toLowerCase());
        if (matched && !detectedTopics.includes(matched)) {
          detectedTopics.push(matched);
        }
      }
    }
  }

  // Check title AND content for topic keywords (detect MULTIPLE topics)
  // Use combinedText to check both title and content
  if ((combinedText.includes("ai") || combinedText.includes("artificial intelligence") || combinedText.includes("machine learning") || combinedText.includes("neural network")) && !detectedTopics.includes("AI")) {
    detectedTopics.push("AI");
  }
  if ((combinedText.includes("automation") || combinedText.includes("automate") || combinedText.includes("workflow")) && !detectedTopics.includes("Automation")) {
    detectedTopics.push("Automation");
  }
  if ((combinedText.includes("web") || combinedText.includes("website") || combinedText.includes("web development") || combinedText.includes("frontend") || combinedText.includes("backend")) && !detectedTopics.includes("Web")) {
    detectedTopics.push("Web");
  }
  if ((combinedText.includes("startup") || combinedText.includes("entrepreneur") || combinedText.includes("venture capital") || combinedText.includes("accelerator") || combinedText.includes("funding") || combinedText.includes("fund for")) && !detectedTopics.includes("Startups")) {
    detectedTopics.push("Startups");
  }
  if ((combinedText.includes("defi") || combinedText.includes("decentralized finance") || combinedText.includes("blockchain finance")) && !detectedTopics.includes("Defi")) {
    detectedTopics.push("Defi");
  }
  if ((combinedText.includes("web3") || combinedText.includes("blockchain") || combinedText.includes("cryptocurrency") || combinedText.includes("nft")) && !detectedTopics.includes("Web3")) {
    detectedTopics.push("Web3");
  }
  if ((combinedText.includes("work") || combinedText.includes("workplace") || combinedText.includes("remote work") || combinedText.includes("productivity")) && !detectedTopics.includes("Work")) {
    detectedTopics.push("Work");
  }
  if ((combinedText.includes("design") || combinedText.includes("ui") || combinedText.includes("ux") || combinedText.includes("user interface")) && !detectedTopics.includes("Design")) {
    detectedTopics.push("Design");
  }
  if ((combinedText.includes("workplace culture") || combinedText.includes("company culture") || combinedText.includes("organizational culture") || combinedText.includes("corporate culture")) && !detectedTopics.includes("Culture")) {
    detectedTopics.push("Culture");
  }

  // Return comma-separated topics, or default to AI if none found
  if (detectedTopics.length > 0) {
    return detectedTopics.join(", ");
  }

  // If no match found, this should not have passed filtering - return a safe default but log error
  console.error(`[Code] ERROR: No topic match found for content. This article should have been filtered out. Content: ${content.substring(0, 100)}...`);
  // Return "AI" as fallback, but this indicates a filtering issue
  return "AI";
}

/**
 * Generate meta title from content
 */
function generateMetaTitle(content: string, primaryKeyword?: string, rssTitle?: string): string {
  // ALWAYS prefer RSS title if available (best source - most accurate)
  if (rssTitle && rssTitle.trim().length > 0) {
    let title = rssTitle.trim();
    
    // Remove markdown formatting if present
    title = title.replace(/^#+\s*/, "").replace(/\*\*/g, "").replace(/<[^>]+>/g, "").trim();
    
    // Only add keyword if title is short enough and keyword fits naturally
    if (primaryKeyword && !title.toLowerCase().includes(primaryKeyword.toLowerCase())) {
      const withKeyword = `${title}: ${primaryKeyword}`;
      if (withKeyword.length <= 60) {
        title = withKeyword;
      }
    }
    
    // Ensure it's under 60 characters
    if (title.length > 60) {
      title = title.slice(0, 57) + "...";
    }
    
    return title;
  }

  // Extract first heading from markdown (but skip generic ones)
  const headingMatch = content.match(/##\s+(.+?)(?:\n|$)/);
  if (headingMatch) {
    let title = headingMatch[1].trim();
    
    // Remove markdown formatting
    title = title.replace(/\*\*/g, "").replace(/#/g, "").trim();
    
    // Skip generic headings like "Introduction", "Conclusion"
    if (!title.match(/^(Introduction|Conclusion|Key Points|Key Insights|Implications)$/i) && title.length > 5) {
      if (primaryKeyword && !title.toLowerCase().includes(primaryKeyword.toLowerCase())) {
        const withKeyword = `${title}: ${primaryKeyword}`;
        if (withKeyword.length <= 60) {
          title = withKeyword;
        }
      }
      return title.slice(0, 60);
    }
  }

  // Fallback: use first sentence with keyword
  // Remove markdown/HTML first
  const cleanContent = content.replace(/^#+\s*/, "").replace(/\*\*/g, "").replace(/<[^>]+>/g, " ").trim();
  const firstSentence = cleanContent.split(/[.!?]/)[0] || cleanContent.slice(0, 100);
  let title = firstSentence.trim().slice(0, 50);
  
  if (primaryKeyword && !title.toLowerCase().includes(primaryKeyword.toLowerCase())) {
    title = `${title}: ${primaryKeyword}`;
  }

  return title.slice(0, 60);
}

/**
 * Generate meta description from content
 */
function generateMetaDescription(content: string, primaryKeyword?: string): string {
  // Extract first 2-3 sentences
  const sentences = content
    .replace(/<[^>]+>/g, " ") // Remove HTML
    .split(/[.!?]/)
    .filter((s) => s.trim().length > 20)
    .slice(0, 3)
    .join(". ")
    .trim();

  let description = sentences || content.slice(0, 200);

  // Add keyword if not present
  if (primaryKeyword && !description.toLowerCase().includes(primaryKeyword.toLowerCase())) {
    description = `${description}. Learn about ${primaryKeyword}.`;
  }

  return description.slice(0, 160);
}

/**
 * Optimize blog content for SEO using code-based approach.
 * Categories parameter is optional for compatibility with OpenAI version.
 */
export async function optimizeForSEO(
  blogContent: string,
  categories?: string[],
  rssTitle?: string
): Promise<SEOResult> {
  console.log("[Code] Optimizing content for SEO...");

  // Extract keywords (targeting 15-20 keywords for SEO dominance)
  const keywords = extractKeywords(blogContent);
  // Smart primary keyword selection: choose the most relevant keyword based on content and title
  // Analyze content to determine the best primary keyword
  const contentLower = blogContent.toLowerCase();
  const titleLower = (rssTitle || "").toLowerCase();
  
  let primaryKeyword = keywords[0] || "app development";
  
  // Priority: Check title first (most descriptive), then content
  if (titleLower.includes("ai agent") || contentLower.includes("ai agent")) {
    primaryKeyword = "AI agent";
  } else if (titleLower.includes("startup accelerator") || titleLower.includes("accelerator") || contentLower.includes("startup accelerator")) {
    primaryKeyword = "startup accelerator";
  } else if (titleLower.includes("ai software") || contentLower.includes("ai software")) {
    primaryKeyword = "AI software";
  } else if (titleLower.includes("openai") || (contentLower.includes("openai") && contentLower.includes("ai"))) {
    primaryKeyword = "AI software";
  } else if (titleLower.includes("digital transformation") || contentLower.includes("digital transformation")) {
    primaryKeyword = "digital transformation";
  } else if (titleLower.includes("workforce automation") || contentLower.includes("workforce automation")) {
    primaryKeyword = "workforce automation";
  } else if (titleLower.includes("app development") || (contentLower.includes("app development") && ((contentLower.match(/\bapp development\b/g) || []).length > 2))) {
    primaryKeyword = "app development";
  } else if (contentLower.includes("ai") && (contentLower.includes("software") || contentLower.includes("platform") || contentLower.includes("tool"))) {
    primaryKeyword = "AI software";
  } else if (keywords.length > 0) {
    // Use the first keyword that appears multiple times in content
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      const count = (contentLower.match(new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')) || []).length;
      if (count >= 2) {
        primaryKeyword = keyword;
        break;
      }
    }
  }
  
  // Log keyword strategy
  console.log(`[Code] Extracted ${keywords.length} keywords (target: 15-20)`);
  if (keywords.length < 10) {
    console.warn(`[Code] Warning: Only ${keywords.length} keywords found. Consider expanding keyword coverage.`);
  }

  // NEW: Integrate primary keyword strategically (2-4 times)
  let optimizedContent = integratePrimaryKeyword(blogContent, primaryKeyword, 3);
  
  // NEW: Add semantic keywords naturally
  optimizedContent = integrateSemanticKeywords(optimizedContent, primaryKeyword);
  
  // Add strategic internal links (targeting 8-12 links for SEO)
  optimizedContent = addInternalLinks(optimizedContent);
  
  // Count links added
  const linkMatches = optimizedContent.match(/<a href="[^"]+">/g);
  const linkCount = linkMatches ? linkMatches.length : 0;
  console.log(`[Code] Added ${linkCount} internal links (target: 8-12)`);
  if (linkCount < 8) {
    console.warn(`[Code] Warning: Only ${linkCount} internal links added. Consider adding more strategic links.`);
  }

  // Determine topic
  const topics = determineTopic(blogContent, categories, rssTitle);

  // Generate meta title and description
  // For meta title, prioritize RSS title - it's the most accurate
  // Clean content first to remove markdown headings that might interfere
  const cleanContent = blogContent.replace(/^##\s+[^\n]+\n\n/gm, "").trim(); // Remove markdown headings
  const metaTitle = generateMetaTitle(cleanContent, primaryKeyword, rssTitle);
  const metaDescription = generateMetaDescription(cleanContent, primaryKeyword);
  
  // Debug: Log what we're using for meta title
  if (rssTitle) {
    console.log(`[Code] Using RSS title for meta: ${rssTitle.substring(0, 60)}`);
  } else {
    console.log(`[Code] No RSS title provided, extracting from content`);
  }

  // IMPORTANT: Remove any existing META_TITLE, META_DESCRIPTION, TOPICS from content
  // These should NOT appear in the final content
  optimizedContent = optimizedContent
    .replace(/\n\nMETA_TITLE:.*$/gm, "")
    .replace(/\n\nMETA_DESCRIPTION:.*$/gm, "")
    .replace(/\n\nTOPICS:.*$/gm, "")
    .replace(/META_TITLE:.*$/gm, "")
    .replace(/META_DESCRIPTION:.*$/gm, "")
    .replace(/TOPICS:.*$/gm, "")
    .trim();

  console.log("[Code] SEO optimization complete.");
  console.log(`[Code] Primary keyword: ${primaryKeyword}`);
  console.log(`[Code] Topic: ${topics}`);

  return {
    optimizedContent,
    metaTitle,
    metaDescription,
    topics,
    primaryKeyword,
  };
}
