/**
 * Pre-validation content adjustment to ensure articles pass validation
 * Adjusts keyword frequency, removes duplicates, and ensures quality standards
 */

/**
 * Get semantic variations for a primary keyword
 */
function getSemanticKeywords(primaryKeyword: string): string[] {
  const semanticMap: Record<string, string[]> = {
    'ai agent': ['AI assistant', 'intelligent agent', 'autonomous agent', 'AI automation', 'agent technology', 'automated system'],
    'ai software': ['artificial intelligence platform', 'AI solution', 'machine learning software', 'AI system', 'intelligent software', 'AI technology'],
    'digital transformation': ['digital strategy', 'digital innovation', 'digital adoption', 'business transformation', 'digital modernization', 'digital evolution'],
    'workforce automation': ['workplace automation', 'business automation', 'process automation', 'task automation', 'operational automation', 'workflow automation'],
    'app development': ['application development', 'mobile app development', 'software development', 'app creation', 'application engineering', 'app building'],
    'startup accelerator': ['startup program', 'accelerator program', 'startup incubator', 'business accelerator', 'startup support program', 'accelerator initiative']
  };
  
  const keywordLower = primaryKeyword.toLowerCase();
  return semanticMap[keywordLower] || [];
}

/**
 * Adjust keyword frequency to meet validation requirements
 */
function adjustKeywordFrequency(content: string, primaryKeyword: string): string {
  if (!primaryKeyword) return content;
  
  const keywordLower = primaryKeyword.toLowerCase();
  const contentLower = content.toLowerCase();
  const keywordRegex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  const currentCount = (contentLower.match(keywordRegex) || []).length;
  
  // For multi-word keywords (2+ words), allow up to 6 occurrences
  const maxOccurrences = primaryKeyword.split(/\s+/).length >= 2 ? 6 : 4;
  
  // If keyword appears too many times, replace excess with semantic variations
  if (currentCount > maxOccurrences) {
    const semanticKeywords = getSemanticKeywords(primaryKeyword);
    if (semanticKeywords.length === 0) return content;
    
    let adjusted = content;
    const excess = currentCount - maxOccurrences;
    let replaced = 0;
    
    // Split content into lines to check for headings
    const lines = adjusted.split('\n');
    const processedLines: string[] = [];
    
    for (const line of lines) {
      // Skip headings - don't replace keywords in headings (they're important for SEO)
      if (line.trim().startsWith('#') || line.trim().startsWith('##') || line.trim().startsWith('###')) {
        processedLines.push(line);
        continue;
      }
      
      // Process non-heading lines
      let processedLine = line;
      const lineLower = processedLine.toLowerCase();
      const lineMatches = (lineLower.match(keywordRegex) || []).length;
      
      if (lineMatches > 0 && replaced < excess) {
        // Replace keyword in this line (but keep first occurrence in first 100 words)
        const beforeLine = processedLines.join('\n');
        const beforeWordCount = beforeLine.split(/\s+/).length;
        const isInFirst100Words = beforeWordCount < 100;
        
        processedLine = processedLine.replace(keywordRegex, (match, offset) => {
          // Keep first occurrence if in first 100 words
          if (isInFirst100Words && offset === 0) {
            return match;
          }
          
          // Replace excess occurrences
          if (replaced < excess) {
            const semantic = semanticKeywords[replaced % semanticKeywords.length];
            replaced++;
            return semantic;
          }
          return match;
        });
      }
      
      processedLines.push(processedLine);
    }
    
    adjusted = processedLines.join('\n');
    
    if (replaced > 0) {
      console.log(`[PreValidation] Reduced keyword "${primaryKeyword}" from ${currentCount} to ${currentCount - replaced} occurrences`);
    }
    
    return adjusted;
  }
  
  return content;
}

/**
 * Remove duplicate sentences more aggressively
 */
function removeDuplicateSentences(content: string): string {
  const sentences = content.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 20);
  const seen = new Set<string>();
  const uniqueSentences: string[] = [];
  
  for (const sentence of sentences) {
    const normalized = sentence.toLowerCase().replace(/\s+/g, ' ');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueSentences.push(sentence);
    }
  }
  
  // If we removed significant duplicates, reconstruct content
  if (uniqueSentences.length < sentences.length * 0.7) {
    // Too many duplicates removed - keep original to avoid breaking structure
    return content;
  }
  
  // Reconstruct with unique sentences (preserve structure as much as possible)
  // This is a simple approach - in practice, we'd want to preserve paragraph structure
  return content; // For now, return original - duplicate removal is handled in contentGeneratorCode
}

/**
 * Main adjustment function - ensures content passes validation
 */
export function adjustContentForValidation(
  content: string,
  primaryKeyword?: string
): string {
  let adjusted = content;
  
  // 1. Adjust keyword frequency if too high
  if (primaryKeyword) {
    adjusted = adjustKeywordFrequency(adjusted, primaryKeyword);
  }
  
  // 2. Remove duplicate sentences (handled in contentGeneratorCode, but double-check here)
  // For now, we'll rely on contentGeneratorCode to handle this
  
  return adjusted;
}
