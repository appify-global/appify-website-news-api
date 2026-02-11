import { RSSItem } from "./rss";
import https from "https";
import http from "http";
import { URL } from "url";

/**
 * Extract main content from an article URL using basic HTML parsing.
 * This is a code-based alternative to OpenAI content generation.
 */
async function fetchArticleContent(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === "https:" ? https : http;

    client
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to fetch article: ${response.statusCode}`));
          return;
        }

        let html = "";
        response.on("data", (chunk) => {
          html += chunk.toString();
        });

        response.on("end", () => {
          // Basic HTML parsing - extract text from common article tags
          const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
          const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
          const contentMatch = html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

          let content = articleMatch?.[1] || mainMatch?.[1] || contentMatch?.[1] || html;

          // Remove script and style tags
          content = content.replace(/<script[\s\S]*?<\/script>/gi, "");
          content = content.replace(/<style[\s\S]*?<\/style>/gi, "");

          // Extract text from paragraphs
          const paragraphs = content.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
          const text = paragraphs
            .map((p) => p.replace(/<[^>]+>/g, " ").trim())
            .filter((t) => t.length > 50) // Filter out very short paragraphs
            .slice(0, 20) // Take first 20 paragraphs
            .join("\n\n");

          resolve(text || content.replace(/<[^>]+>/g, " ").slice(0, 5000));
        });
      })
      .on("error", reject);
  });
}

/**
 * Generate blog content from RSS item using code-based approach.
 * Extracts content from the source article and structures it.
 */
export async function generateBlogContent(item: RSSItem): Promise<string> {
  console.log(`[Code] Generating blog for: ${item.title}`);

  try {
    // Try to fetch and extract content from the source article
    const articleContent = await fetchArticleContent(item.link);
    
    // Use RSS content snippet as fallback
    const sourceContent = articleContent || item.contentSnippet || item.content || "";

    // Structure the blog post with better content
    const paragraphs = sourceContent.split(/\n\n+/).filter(p => p.trim().length > 30);
    
    const introParagraphs = paragraphs.slice(0, 2);
    const bodyParagraphs = paragraphs.slice(2, 5);
    const conclusionParagraphs = paragraphs.slice(5, 7);
    
    // Use RSS title for the main heading, or create a descriptive one
    const mainHeading = item.title || "Latest Technology Developments";
    
    const blogSections = [
      `## ${mainHeading}`,
      introParagraphs.join("\n\n") || sourceContent.split("\n\n").slice(0, 2).join("\n\n"),
      "",
      "## Key Insights",
      bodyParagraphs.join("\n\n") || sourceContent.split("\n\n").slice(2, 4).join("\n\n") || "This development represents a significant advancement in the technology sector.",
      "",
      "## Implications for App Development",
      "This development highlights the importance of staying current with technological advances in the app development space. For businesses looking to build or enhance their mobile applications, understanding these trends is crucial for maintaining competitive advantage.",
      "",
      "## Conclusion",
      conclusionParagraphs.join("\n\n") || "This news underscores the evolving landscape of technology and its impact on app development practices. Staying informed about these changes helps businesses make better decisions about their technology investments.",
    ];

    const blogContent = blogSections.join("\n\n");
    const wordCount = blogContent.split(/\s+/).length;

    console.log(`[Code] Generated ${wordCount} words from source content.`);
    return blogContent;
  } catch (error: any) {
    console.warn(`[Code] Failed to fetch article content, using RSS snippet: ${error.message}`);
    
    // Fallback: Use RSS content snippet with basic structure
    const fallbackContent = item.contentSnippet || item.content || item.title;
    return `## Introduction\n\n${fallbackContent}\n\n## Key Points\n\nThis development represents an important shift in the technology landscape.\n\n## Conclusion\n\nUnderstanding these changes is essential for businesses navigating the digital transformation space.`;
  }
}
