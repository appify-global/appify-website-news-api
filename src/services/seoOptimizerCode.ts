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
  "mobile app developers",
  "custom software development",
  "app developers Australia",
  "software development",
  "digital transformation",
  "mobile applications",
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
 * Add strategic internal links to content (8-12 links for SEO)
 */
function addInternalLinks(content: string): string {
  let optimized = content;
  let linkCount = 0;
  const maxLinks = 12; // Target 8-12 links

  // Track which links we've added to avoid duplicates
  const addedLinks = new Set<string>();

  // Add internal links based on keywords found (strategic placement)
  // Only add first occurrence of each link type to avoid over-optimization
  
  if (optimized.toLowerCase().includes("automation") && !addedLinks.has("automation") && linkCount < maxLinks) {
    optimized = optimized.replace(
      /(\bautomation\b)/i,
      '<a href="/automation">$1</a>'
    );
    addedLinks.add("automation");
    linkCount++;
  }

  if (optimized.toLowerCase().includes("software development") && !addedLinks.has("software") && linkCount < maxLinks) {
    optimized = optimized.replace(
      /(\bsoftware development\b)/i,
      '<a href="/projects">$1</a>'
    );
    addedLinks.add("software");
    linkCount++;
  }

  if (optimized.toLowerCase().includes("app development") && !addedLinks.has("app-dev") && linkCount < maxLinks) {
    optimized = optimized.replace(
      /(\bapp development\b)/i,
      '<a href="/projects">$1</a>'
    );
    addedLinks.add("app-dev");
    linkCount++;
  }

  if (optimized.toLowerCase().includes("seo") && !addedLinks.has("seo") && linkCount < maxLinks) {
    optimized = optimized.replace(
      /(\bseo\b)/i,
      '<a href="/automation/seo">$1</a>'
    );
    addedLinks.add("seo");
    linkCount++;
  }

  if (optimized.toLowerCase().includes("phone automation") && !addedLinks.has("phone") && linkCount < maxLinks) {
    optimized = optimized.replace(
      /(\bphone automation\b)/i,
      '<a href="/automation/phone">$1</a>'
    );
    addedLinks.add("phone");
    linkCount++;
  }

  if (optimized.toLowerCase().includes("mobile app") && !addedLinks.has("mobile") && linkCount < maxLinks) {
    optimized = optimized.replace(
      /(\bmobile app\b)/i,
      '<a href="/projects">$1</a>'
    );
    addedLinks.add("mobile");
    linkCount++;
  }

  if (optimized.toLowerCase().includes("custom software") && !addedLinks.has("custom") && linkCount < maxLinks) {
    optimized = optimized.replace(
      /(\bcustom software\b)/i,
      '<a href="/projects">$1</a>'
    );
    addedLinks.add("custom");
    linkCount++;
  }

  if (optimized.toLowerCase().includes("digital transformation") && !addedLinks.has("digital") && linkCount < maxLinks) {
    optimized = optimized.replace(
      /(\bdigital transformation\b)/i,
      '<a href="/automation">$1</a>'
    );
    addedLinks.add("digital");
    linkCount++;
  }

  // Add studio link if relevant
  if ((optimized.toLowerCase().includes("design") || optimized.toLowerCase().includes("ui") || optimized.toLowerCase().includes("ux")) && !addedLinks.has("studio") && linkCount < maxLinks) {
    optimized = optimized.replace(
      /(\b(design|ui|ux)\b)/i,
      '<a href="/studio">$1</a>'
    );
    addedLinks.add("studio");
    linkCount++;
  }

  return optimized;
}

/**
 * Determine topic from content and categories
 * Only returns topics from our allowed list: AI, Automation, Web, Startups, Defi, Web3, Work, Design, Culture
 */
function determineTopic(content: string, categories?: string[]): string {
  const lowerContent = content.toLowerCase();
  const categoryStr = categories?.join(" ").toLowerCase() || "";
  
  // Allowed topics (must match exactly)
  const allowedTopics = ["AI", "Automation", "Web", "Startups", "Defi", "Web3", "Work", "Design", "Culture"];
  
  // Check if RSS categories match any allowed topic
  if (categories && categories.length > 0) {
    for (const cat of categories) {
      const normalizedCat = cat.trim();
      if (allowedTopics.includes(normalizedCat)) {
        return normalizedCat;
      }
      // Check case-insensitive match
      const matched = allowedTopics.find(t => t.toLowerCase() === normalizedCat.toLowerCase());
      if (matched) {
        return matched;
      }
    }
  }

  // Check content for topic keywords (only for our allowed topics)
  if (lowerContent.includes("ai") || lowerContent.includes("artificial intelligence") || lowerContent.includes("machine learning") || lowerContent.includes("neural network")) {
    return "AI";
  }
  if (lowerContent.includes("automation") || lowerContent.includes("automate") || lowerContent.includes("workflow")) {
    return "Automation";
  }
  if (lowerContent.includes("web") || lowerContent.includes("website") || lowerContent.includes("web development") || lowerContent.includes("frontend") || lowerContent.includes("backend")) {
    return "Web";
  }
  if (lowerContent.includes("startup") || lowerContent.includes("entrepreneur") || lowerContent.includes("venture capital")) {
    return "Startups";
  }
  if (lowerContent.includes("defi") || lowerContent.includes("decentralized finance") || lowerContent.includes("blockchain finance")) {
    return "Defi";
  }
  if (lowerContent.includes("web3") || lowerContent.includes("blockchain") || lowerContent.includes("cryptocurrency") || lowerContent.includes("nft")) {
    return "Web3";
  }
  if (lowerContent.includes("work") || lowerContent.includes("workplace") || lowerContent.includes("remote work") || lowerContent.includes("productivity")) {
    return "Work";
  }
  if (lowerContent.includes("design") || lowerContent.includes("ui") || lowerContent.includes("ux") || lowerContent.includes("user interface")) {
    return "Design";
  }
  if (lowerContent.includes("culture") || lowerContent.includes("company culture") || lowerContent.includes("workplace culture")) {
    return "Culture";
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

  // Add strategic internal links (targeting 8-12 links for SEO)
  let optimizedContent = addInternalLinks(blogContent);
  
  // Count links added
  const linkMatches = optimizedContent.match(/<a href="[^"]+">/g);
  const linkCount = linkMatches ? linkMatches.length : 0;
  console.log(`[Code] Added ${linkCount} internal links (target: 8-12)`);
  if (linkCount < 8) {
    console.warn(`[Code] Warning: Only ${linkCount} internal links added. Consider adding more strategic links.`);
  }

  // Ensure primary keyword appears in first 150 words (but don't add generic text that will become excerpt)
  const words = optimizedContent.split(/\s+/);
  const first150Words = words.slice(0, 150).join(" ");
  if (!first150Words.toLowerCase().includes(primaryKeyword.toLowerCase())) {
    // Add keyword naturally without generic boilerplate
    optimizedContent = `${optimizedContent}`;
    // Note: We removed the generic "is a key focus in today's technology landscape" text
    // to avoid it appearing in excerpts. The keyword should already be in the content.
  }

  // Determine topic
  const topics = determineTopic(blogContent, categories);

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
