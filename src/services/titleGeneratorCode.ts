/**
 * Code-based title generator.
 * Extracts or generates titles from content without OpenAI.
 */

/**
 * Generate SEO-friendly blog title from content.
 */
export async function generateBlogTitle(content: string, rssTitle?: string): Promise<string> {
  console.log("[Code] Generating blog title...");

  // Try to extract title from first H2 heading
  const headingMatch = content.match(/##\s+(.+?)(?:\n|$)/);
  if (headingMatch) {
    let title = headingMatch[1].trim();
    
    // Remove markdown formatting
    title = title.replace(/\*\*/g, "").replace(/#/g, "").trim();
    
    // Ensure it's under 60 characters
    if (title.length <= 60) {
      console.log(`[Code] Generated title from heading: ${title}`);
      return title;
    }
    
    // Truncate if too long
    title = title.slice(0, 57) + "...";
    console.log(`[Code] Generated title (truncated): ${title}`);
    return title;
  }

  // Use RSS title as base
  if (rssTitle) {
    let title = rssTitle.trim();
    
    // Remove common prefixes
    title = title.replace(/^(Breaking|News|Update):\s*/i, "");
    
    // Add keyword if not present
    const keywords = ["app development", "AI app development", "mobile app developers"];
    const hasKeyword = keywords.some((kw) => title.toLowerCase().includes(kw.toLowerCase()));
    
    if (!hasKeyword && title.length < 50) {
      title = `${title}: App Development Insights`;
    }
    
    // Ensure under 60 characters
    if (title.length > 60) {
      title = title.slice(0, 57) + "...";
    }
    
    console.log(`[Code] Generated title from RSS: ${title}`);
    return title;
  }

  // Fallback: Generate from first sentence
  const firstSentence = content.split(/[.!?]/)[0] || content.slice(0, 100);
  let title = firstSentence.trim().slice(0, 60);
  
  if (title.length < 30) {
    title = `${title}: Technology Insights`;
  }
  
  console.log(`[Code] Generated title from content: ${title}`);
  return title.slice(0, 60);
}
