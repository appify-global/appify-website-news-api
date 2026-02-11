/**
 * Code-based SEO optimization.
 * Extracts keywords, adds internal/external links, and structures content.
 */

interface SEOResult {
  optimizedContent: string;
  metaTitle: string;
  metaDescription: string;
  topics: string;
}

// Common keywords for app development content
const KEYWORDS = [
  "app development",
  "AI app development",
  "mobile app developers",
  "custom software development",
  "app developers Australia",
  "software development",
  "digital transformation",
  "mobile applications",
];

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

  return found.slice(0, 5); // Return top 5 keywords
}

/**
 * Add internal links to content
 */
function addInternalLinks(content: string): string {
  let optimized = content;

  // Add internal links based on keywords found
  if (optimized.toLowerCase().includes("automation")) {
    optimized = optimized.replace(
      /automation/gi,
      '<a href="/automation">automation</a>'
    );
  }

  if (optimized.toLowerCase().includes("software development")) {
    optimized = optimized.replace(
      /software development/gi,
      '<a href="/projects">software development</a>'
    );
  }

  return optimized;
}

/**
 * Determine topic from content and categories
 */
function determineTopic(content: string, categories?: string[]): string {
  const lowerContent = content.toLowerCase();
  const categoryStr = categories?.join(" ").toLowerCase() || "";

  if (lowerContent.includes("ai") || lowerContent.includes("artificial intelligence") || categoryStr.includes("ai")) {
    return "AI";
  }
  if (lowerContent.includes("automation") || categoryStr.includes("automation")) {
    return "Automation";
  }
  if (lowerContent.includes("web") || lowerContent.includes("website") || categoryStr.includes("web")) {
    return "Web";
  }
  if (lowerContent.includes("startup") || categoryStr.includes("startup")) {
    return "Startups";
  }
  if (lowerContent.includes("defi") || lowerContent.includes("crypto") || categoryStr.includes("defi")) {
    return "Defi";
  }
  if (lowerContent.includes("web3") || categoryStr.includes("web3")) {
    return "Web3";
  }
  if (lowerContent.includes("design") || categoryStr.includes("design")) {
    return "Design";
  }
  if (lowerContent.includes("culture") || categoryStr.includes("culture")) {
    return "Culture";
  }

  return "AI"; // Default
}

/**
 * Generate meta title from content
 */
function generateMetaTitle(content: string, primaryKeyword?: string): string {
  // Extract first heading or use first sentence
  const headingMatch = content.match(/##\s+(.+)/);
  if (headingMatch) {
    let title = headingMatch[1].trim();
    if (primaryKeyword && !title.toLowerCase().includes(primaryKeyword.toLowerCase())) {
      title = `${title}: ${primaryKeyword}`;
    }
    return title.slice(0, 60);
  }

  // Fallback: use first sentence with keyword
  const firstSentence = content.split(/[.!?]/)[0] || content.slice(0, 100);
  const title = primaryKeyword
    ? `${firstSentence.slice(0, 40)}: ${primaryKeyword}`
    : firstSentence.slice(0, 60);

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
  categories?: string[]
): Promise<SEOResult> {
  console.log("[Code] Optimizing content for SEO...");

  // Extract keywords
  const keywords = extractKeywords(blogContent);
  const primaryKeyword = keywords[0] || "app development";

  // Add internal links
  let optimizedContent = addInternalLinks(blogContent);

  // Ensure primary keyword appears in first 150 words
  const words = optimizedContent.split(/\s+/);
  const first150Words = words.slice(0, 150).join(" ");
  if (!first150Words.toLowerCase().includes(primaryKeyword.toLowerCase())) {
    optimizedContent = `${primaryKeyword.charAt(0).toUpperCase() + primaryKeyword.slice(1)} is a key focus in today's technology landscape. ${optimizedContent}`;
  }

  // Determine topic
  const topics = determineTopic(blogContent, categories);

  // Generate meta title and description
  const metaTitle = generateMetaTitle(blogContent, primaryKeyword);
  const metaDescription = generateMetaDescription(blogContent, primaryKeyword);

  // Add topic and meta info at the end (for parsing)
  optimizedContent += `\n\nMETA_TITLE: ${metaTitle}\nMETA_DESCRIPTION: ${metaDescription}\nTOPICS: ${topics}`;

  console.log("[Code] SEO optimization complete.");
  console.log(`[Code] Primary keyword: ${primaryKeyword}`);
  console.log(`[Code] Topic: ${topics}`);

  return {
    optimizedContent: optimizedContent.replace(/\n\nMETA_TITLE:.*$/, "").trim(),
    metaTitle,
    metaDescription,
    topics,
  };
}
