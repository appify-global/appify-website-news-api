/**
 * Code-based title generator.
 * Extracts or generates titles from content without OpenAI.
 */

/**
 * Generate SEO-friendly blog title from content.
 */
export async function generateBlogTitle(content: string, rssTitle?: string): Promise<string> {
  console.log("[Code] Generating blog title...");

  // Prefer RSS title if available (it's usually better than extracted headings)
  if (rssTitle) {
    let title = rssTitle.trim();
    
    // Remove common prefixes
    title = title.replace(/^(Breaking|News|Update):\s*/i, "");
    
    // Don't truncate - use full RSS title
    // The RSS title is usually well-formatted and should be preserved as-is
    
    console.log(`[Code] Using full RSS title: ${title}`);
    return title;
  }

  // Try to extract title from first H2 heading in HTML (but skip generic ones like "Introduction")
  const htmlHeadingMatch = content.match(/<h2[^>]*>(.+?)<\/h2>/i);
  if (htmlHeadingMatch) {
    let title = htmlHeadingMatch[1].trim();
    
    // Remove any HTML tags that might be inside
    title = title.replace(/<[^>]+>/g, "").trim();
    
    // Skip generic headings
    if (!title.match(/^(Introduction|Conclusion|Key Points|Key Insights|Implications)$/i)) {
      // Return title if it's valid (length > 5)
      if (title.length > 5) {
        console.log(`[Code] Generated title from HTML heading: ${title}`);
        return title;
      }
    }
  }

  // Try to extract title from markdown heading (## Heading)
  const headingMatch = content.match(/##\s+(.+?)(?:\n|$)/);
  if (headingMatch) {
    let title = headingMatch[1].trim();
    
    // Remove markdown formatting and HTML tags
    title = title.replace(/\*\*/g, "").replace(/#/g, "").replace(/<[^>]+>/g, "").trim();
    
    // Skip generic headings
    if (!title.match(/^(Introduction|Conclusion|Key Points|Key Insights|Implications)$/i)) {
      // Return full title if it's valid (length > 5)
      if (title.length > 5) {
        console.log(`[Code] Generated title from heading: ${title}`);
        return title;
      }
    }
  }

  // Fallback: Generate from first sentence
  const firstSentence = content.split(/[.!?]/)[0] || content.slice(0, 100);
  let title = firstSentence.trim();
  
  if (title.length < 30) {
    title = `${title}: Technology Insights`;
  }
  
  // Don't truncate - return full title
  console.log(`[Code] Generated title from content: ${title}`);
  return title;
}
