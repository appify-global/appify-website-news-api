/**
 * Code-based meta description generator.
 * Generates meta descriptions from content without OpenAI.
 */

/**
 * Generate meta description from blog content.
 */
export async function generateMetaDescription(content: string): Promise<string> {
  console.log("[Code] Generating meta description...");

  // Remove HTML tags for text extraction
  let textContent = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  
  // Remove markdown headings and generic heading text
  textContent = textContent.replace(/^#+\s*/, ""); // Remove markdown heading markers
  textContent = textContent.replace(/^(Introduction|Conclusion|Key Points|Key Insights|Implications)\s+/i, "");

  // Extract first 2-3 sentences (aiming for 150-160 characters)
  const sentences = textContent.split(/[.!?]/).filter((s) => {
    const trimmed = s.trim();
    // Filter out very short sentences and heading-like text
    return trimmed.length > 20 && !trimmed.match(/^(Introduction|Conclusion|Key Points)/i);
  });

  let description = "";
  
  // Try to get 2-3 sentences that total ~150-160 characters
  for (const sentence of sentences) {
    const candidate = description 
      ? `${description}. ${sentence.trim()}`
      : sentence.trim();
    
    if (candidate.length > 160) {
      break;
    }
    
    description = candidate;
    
    if (description.length >= 120) {
      break; // Good length
    }
  }

  // If we don't have enough, use first sentence + context
  if (description.length < 100) {
    const firstSentence = sentences[0] || textContent.slice(0, 100);
    description = `${firstSentence.trim()}. Learn about the latest developments in app development and technology.`;
  }

  // Ensure it's under 160 characters
  if (description.length > 160) {
    // Find a good breaking point
    const truncated = description.slice(0, 157);
    const lastPeriod = truncated.lastIndexOf(".");
    const lastSpace = truncated.lastIndexOf(" ");
    
    if (lastPeriod > 120) {
      description = description.slice(0, lastPeriod + 1);
    } else if (lastSpace > 120) {
      description = description.slice(0, lastSpace) + "...";
    } else {
      description = truncated + "...";
    }
  }

  console.log(`[Code] Generated meta description (${description.length} chars)`);
  return description;
}
