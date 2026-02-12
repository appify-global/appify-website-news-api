import { RSSItem } from "./rss";
import https from "https";
import http from "http";
import { URL } from "url";

/**
 * Extract main content from an article URL using basic HTML parsing.
 * This is a code-based alternative to OpenAI content generation.
 */
async function fetchArticleContent(url: string): Promise<{ content: string; imageUrl?: string }> {
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
          // Extract featured image first
          let imageUrl: string | undefined;
          const ogImageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
          if (ogImageMatch && ogImageMatch[1]) {
            imageUrl = ogImageMatch[1];
          } else {
            // Try to find first large image in article
            const imgMatches = html.match(/<img[^>]+src="([^"]+)"[^>]*>/gi);
            if (imgMatches && imgMatches.length > 0) {
              const firstImg = imgMatches[0].match(/src="([^"]+)"/i);
              if (firstImg && firstImg[1] && !firstImg[1].includes("icon") && !firstImg[1].includes("logo")) {
                imageUrl = firstImg[1];
              }
            }
          }

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
            .map((p) => {
              // Remove all HTML tags
              let clean = p.replace(/<[^>]+>/g, " ");
              // Decode HTML entities
              clean = clean.replace(/&nbsp;/g, " ")
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, "'")
                .replace(/&apos;/g, "'");
              // Remove extra whitespace
              clean = clean.replace(/\s+/g, " ").trim();
              return clean;
            })
            .filter((t) => {
              // Filter out very short paragraphs
              if (t.length < 50) return false;
              // Filter out UI elements and source article metadata
              const lower = t.toLowerCase();
              return !lower.match(/^(save story|share|subscribe|sign up|photograph:|photo-illustration:|comment loader|getty images|wired staff)/i) &&
                     !lower.includes("comment loader") &&
                     !lower.includes("save this story") &&
                     !lower.includes("photo-illustration:");
            })
            .slice(0, 50) // Take up to 50 paragraphs for longer content
            .join("\n\n");

          resolve({ 
            content: text || content.replace(/<[^>]+>/g, " ").slice(0, 5000),
            imageUrl 
          });
        });
      })
      .on("error", reject);
  });
}

/**
 * Rephrase and expand a paragraph to add more words while maintaining meaning
 * Avoids 1:1 plagiarism by restructuring and adding context
 */
/**
 * Rephrase a paragraph to add variety without generic filler
 * Uses synonyms and restructures sentences while keeping the core meaning
 */
function rephraseParagraph(paragraph: string): string {
  const trimmed = paragraph.trim();
  if (trimmed.length < 50) {
    return trimmed; // Too short to rephrase meaningfully
  }
  
  // Simple rephrasing: swap sentence order, use synonyms, restructure
  const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 10);
  if (sentences.length <= 1) {
    return trimmed; // Single sentence, return as-is
  }
  
  // For multiple sentences, we can reorder or combine, but keep original meaning
  // For now, just return the original - rephrasing should be done more carefully
  // to avoid generic filler
  return trimmed;
}

/**
 * Extract additional relevant paragraphs from RSS content or source
 * Returns quality paragraphs that haven't been used yet
 */
function getAdditionalSourceParagraphs(
  sourceContent: string,
  usedParagraphs: Set<string>,
  targetCount: number
): string[] {
  const allParagraphs = sourceContent.split(/\n\n+/).filter((p: string) => {
    const trimmed = p.trim();
    const lowerTrimmed = trimmed.toLowerCase();
    
    // Quality filters: substantial length, no UI elements, no generic filler
    return trimmed.length > 80
      && !trimmed.match(/^##+\s+/)
      && !lowerTrimmed.match(/^(save story|share|subscribe|sign up|photograph:|photo-illustration:)/i)
      && !lowerTrimmed.includes("comment loader")
      && !lowerTrimmed.includes("getty images")
      && !lowerTrimmed.includes("wired staff")
      && !isGenericFiller(trimmed);
  });
  
  const additional: string[] = [];
  for (const p of allParagraphs) {
    const fingerprint = p.trim().toLowerCase().replace(/\s+/g, " ").substring(0, 200);
    if (!usedParagraphs.has(fingerprint) && additional.length < targetCount) {
      additional.push(p.trim());
      usedParagraphs.add(fingerprint);
    }
  }
  
  return additional;
}

/**
 * Extract key concepts from content for contextual analysis
 */
function extractKeyConcepts(content: string, title: string): string[] {
  const concepts: string[] = [];
  const lowerContent = (content + " " + title).toLowerCase();
  
  // Extract important concepts
  const conceptPatterns = [
    /(startup accelerator|accelerator program|startup program)/gi,
    /(ai software|artificial intelligence software|ai platform)/gi,
    /(digital transformation|digital strategy|digital innovation)/gi,
    /(workforce automation|workplace automation|business automation)/gi,
    /(app development|application development|software development)/gi,
    /(machine learning|neural network|deep learning)/gi,
    /(cloud computing|cloud platform|cloud infrastructure)/gi,
    /(data analytics|business intelligence|data strategy)/gi,
  ];
  
  conceptPatterns.forEach(pattern => {
    const matches = lowerContent.match(pattern);
    if (matches) {
      matches.forEach(match => {
        if (!concepts.includes(match)) {
          concepts.push(match);
        }
      });
    }
  });
  
  // Also extract from title
  const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  titleWords.forEach(word => {
    if (!concepts.includes(word) && concepts.length < 5) {
      concepts.push(word);
    }
  });
  
  return concepts.slice(0, 5); // Limit to 5 concepts
}

/**
 * Filter out time-based openings and news-style starts
 */
/**
 * Normalize quotes safely without breaking sentences
 * Converts curly quotes, removes attribution fragments, but keeps sentences intact
 */
function normalizeQuotes(content: string): string {
  let result = content;
  
  // Step 1: Convert curly quotes to plain quotes
  result = result
    .replace(/[""]/g, '"')  // Left double quote
    .replace(/[""]/g, '"')  // Right double quote
    .replace(/['']/g, "'")  // Left single quote
    .replace(/['']/g, "'"); // Right single quote
  
  // Step 2: Remove dangling attribution fragments WITHOUT deleting full sentences
  // Remove standalone attribution phrases that appear at sentence boundaries
  result = result
    .replace(/\s+(said|says|according to|told|stated|quoted|in an interview|in a statement)\s*[.!?]/gi, '.')
    .replace(/\([^)]*\b(said|says|according to|told|stated|quoted)\b[^)]*\)/gi, '') // Remove parenthetical attributions
    .replace(/\[[^\]]*\b(said|says|according to|told|stated|quoted)\b[^\]]*\]/gi, ''); // Remove bracketed attributions
  
  // Step 3: If a sentence contains a quote, keep the sentence but remove quote marks only
  // Don't remove the entire quoted content, just clean up the marks
  result = result
    .replace(/"([^"]{10,})"/g, '$1') // Remove quote marks but keep content (min 10 chars to avoid removing single words)
    .replace(/'([^']{10,})'/g, '$1'); // Same for single quotes
  
  // Step 4: Clean up any double spaces or punctuation artifacts
  result = result
    .replace(/\s{2,}/g, ' ')
    .replace(/\.\s*\./g, '.')
    .replace(/,\s*,/g, ',')
    .trim();
  
  return result;
}

/**
 * Remove news fragments and reporting language
 */
function removeNewsFragments(content: string): string {
  return content
    .replace(/\b(announced|reported|revealed|disclosed|confirmed|unveiled|launched|introduced)\b/gi, '')
    .replace(/\b(in an interview|in a statement|according to sources|sources say|according to)\b/gi, '')
    .replace(/\b(on|this|last|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|year)\b/gi, '')
    .replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/gi, '')
    .trim();
}

/**
 * Remove newsletter references and CTAs
 */
function removeNewsletterReferences(content: string): string {
  return content
    .replace(/subscribe to [^.!?]+/gi, '')
    .replace(/sign up for [^.!?]+/gi, '')
    .replace(/join our [^.!?]+/gi, '')
    .replace(/for more [^.!?]+newsletter[^.!?]+/gi, '')
    .replace(/weekly [^.!?]+newsletter[^.!?]+/gi, '')
    .replace(/digital nation[^.!?]+newsletter[^.!?]+/gi, '')
    .replace(/e-newsletter[^.!?]+/gi, '')
    .trim();
}

function filterTimeBasedOpenings(paragraphs: string[]): string[] {
  const timeBasedPatterns = [
    /^on (tuesday|wednesday|thursday|friday|saturday|sunday|monday)/i,
    /^recently/i,
    /^this week/i,
    /^this month/i,
    /^this year/i,
    /^yesterday/i,
    /^today/i,
    /^last week/i,
    /^last month/i,
    /^[A-Z][a-z]+ announced/i,
    /^[A-Z][a-z]+ said/i,
    /^[A-Z][a-z]+ revealed/i,
    /^[A-Z][a-z]+ reported/i,
    /^[A-Z][a-z]+ told/i,
    /^[A-Z][a-z]+ stated/i,
    /^in an interview/i,
    /^according to/i,
  ];
  
  return paragraphs.filter(p => {
    const firstSentence = p.trim().split(/[.!?]/)[0];
    // Also check if paragraph contains quotes or news fragments
    const hasQuotes = /"[^"]{20,}"/.test(p) || /\b(said|says|according to|told|stated|quoted|in an interview)\b/i.test(p);
    const hasNewsFragment = /\b(announced|reported|revealed|in a statement)\b/i.test(p);
    const hasNewsletter = /\b(subscribe|newsletter|sign up|e-newsletter)\b/i.test(p);
    
    return !timeBasedPatterns.some(pattern => pattern.test(firstSentence)) 
      && !hasQuotes 
      && !hasNewsFragment 
      && !hasNewsletter;
  });
}

/**
 * Identify the core concept/trend from content (not the company)
 * Priority: Check title first, then content
 */
function extractCoreConcept(content: string, title: string): string {
  const lowerContent = content.toLowerCase();
  const lowerTitle = title.toLowerCase();
  
  // Check title first (most descriptive)
  if (lowerTitle.includes("startup accelerator") || lowerTitle.includes("accelerator")) {
    return "startup accelerator";
  }
  if (lowerTitle.includes("ai agent")) {
    return "AI agent";
  }
  if (lowerTitle.includes("ai software")) {
    return "AI software";
  }
  if (lowerTitle.includes("digital transformation")) {
    return "digital transformation";
  }
  if (lowerTitle.includes("workforce automation")) {
    return "workforce automation";
  }
  if (lowerTitle.includes("app development")) {
    return "app development";
  }
  
  // Then check content
  if (lowerContent.includes("startup accelerator") || lowerContent.includes("accelerator program")) {
    return "startup accelerator";
  }
  if (lowerContent.includes("ai agent")) {
    return "AI agent";
  }
  if (lowerContent.includes("ai software") || lowerContent.includes("artificial intelligence software")) {
    return "AI software";
  }
  if (lowerContent.includes("digital transformation")) {
    return "digital transformation";
  }
  if (lowerContent.includes("workforce automation")) {
    return "workforce automation";
  }
  if (lowerContent.includes("app development")) {
    return "app development";
  }
  
  // Default fallback
  return "technology innovation";
}

/**
 * Check if paragraph is generic filler
 */
function isGenericFiller(paragraph: string): boolean {
  const genericPatterns = [
    /industry landscape continues to evolve/i,
    /presenting new opportunities and challenges/i,
    /understanding the strategic implications/i,
    /essential for businesses looking to maintain competitive advantage/i,
    /maintain competitive advantage/i,
    /stay ahead of the competition/i,
    /industry leaders recognize the importance/i,
    /staying informed about emerging trends/i,
    /adapting their strategies accordingly/i,
    /significant implications for the technology industry/i,
    /how businesses approach digital transformation/i,
    /staying ahead in an increasingly competitive/i,
    /comprehensive analysis of what this means/i,
    /significant shift in the technology landscape/i,
    /far-reaching implications for businesses/i,
    /reshaping how organizations operate/i,
    /compete in the digital marketplace/i,
    /strategic implications/i,
    /essential for businesses/i,
  ];
  
  const lowerPara = paragraph.toLowerCase();
  return genericPatterns.some(pattern => pattern.test(lowerPara));
}

/**
 * Check if paragraph is too short or broken
 * Only flag truly broken content (< 25 chars or no sentence structure)
 */
function isBrokenParagraph(paragraph: string): boolean {
  const trimmed = paragraph.trim();
  // Only flag if extremely short (< 25 characters)
  if (trimmed.length < 25) return true;
  
  // Check if it has at least one sentence (ends with punctuation)
  const hasSentenceEnd = /[.!?]\s*$/.test(trimmed);
  if (!hasSentenceEnd && trimmed.split(/\s+/).length < 5) return true; // Very short fragment
  
  return false;
}

/**
 * Count company mentions in content
 */
function countCompanyMentions(content: string): number {
  // Common company names that might appear
  const companyPatterns = [
    /\b(meta|microsoft|google|anthropic|openai|mistral|aws|amd|qualcomm|ovh|sequoia|general catalyst|lightspeed|station f|y combinator)\b/gi,
  ];
  
  let count = 0;
  companyPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) count += matches.length;
  });
  
  return count;
}

/**
 * Get the correct article (a/an) for a concept
 */
function getArticle(concept: string): string {
  const firstWord = concept.trim().split(/\s+/)[0].toLowerCase();
  const firstChar = firstWord.charAt(0);
  
  // Words starting with vowels (a, e, i, o, u) use "an"
  // Also "h" words that start with a vowel sound (e.g., "hour", "honor")
  if (/^[aeiou]/.test(firstChar)) {
    return "an";
  }
  
  // Special case: "h" words that start with vowel sound
  const vowelSoundH = ["hour", "honor", "honest", "heir"];
  if (vowelSoundH.includes(firstWord)) {
    return "an";
  }
  
  return "a";
}

/**
 * Generate topic-specific, SEO-optimized headings based on the core concept
 * Headings must be specific and match search queries, not generic
 */
function generateTopicSpecificHeadings(coreConcept: string, title: string, content: string): {
  section2: string; // Market/Strategic Context
  section3: string; // Operational Mechanics
  section4: string; // Benefits & Trade-Offs
  section5: string; // Business Response
  section6: string; // Industry Impact (optional)
} {
  const conceptLower = coreConcept.toLowerCase();
  const capitalized = coreConcept.charAt(0).toUpperCase() + coreConcept.slice(1);
  const contentLower = (title + " " + content).toLowerCase();
  
  // Section 2: Market/Strategic Context (replaces "Why It Matters")
  let section2: string;
  if (conceptLower.includes("startup accelerator") || conceptLower.includes("accelerator")) {
    section2 = "Why AI Labs Invest in Startup Accelerators";
  } else if (conceptLower.includes("ai agent") || conceptLower.includes("autonomous")) {
    section2 = "Why Autonomous AI Agents Are Gaining Traction";
  } else if (conceptLower.includes("ai software")) {
    section2 = "Market Drivers Behind AI Software Adoption";
  } else if (conceptLower.includes("digital transformation")) {
    section2 = "Strategic Incentives for Digital Transformation";
  } else if (conceptLower.includes("workforce automation")) {
    section2 = "Why Organizations Are Adopting Workforce Automation";
  } else if (conceptLower.includes("app development")) {
    section2 = "Market Forces Driving Modern App Development";
  } else {
    // Generic fallback - but still topic-specific
    section2 = `Strategic Context for ${capitalized}`;
  }
  
  // Section 3: Operational Mechanics (replaces "How It Works")
  let section3: string;
  if (conceptLower.includes("startup accelerator") || conceptLower.includes("accelerator")) {
    section3 = "How AI Accelerator Programs Structure Funding and Credits";
  } else if (conceptLower.includes("ai agent") || conceptLower.includes("autonomous")) {
    section3 = "How AI Agents Access Local Systems and APIs";
  } else if (conceptLower.includes("ai software")) {
    section3 = "How AI Software Platforms Operate and Integrate";
  } else if (conceptLower.includes("digital transformation")) {
    section3 = "How Digital Transformation Initiatives Are Executed";
  } else if (conceptLower.includes("workforce automation")) {
    section3 = "How Workforce Automation Systems Function";
  } else if (conceptLower.includes("app development")) {
    section3 = "How Modern App Development Processes Work";
  } else {
    section3 = `How ${capitalized} Operates Strategically`;
  }
  
  // Section 4: Benefits & Trade-Offs (make topic-specific)
  let section4: string;
  if (conceptLower.includes("startup accelerator") || conceptLower.includes("accelerator")) {
    section4 = "Benefits and Risks of AI Startup Accelerators";
  } else if (conceptLower.includes("ai agent") || conceptLower.includes("autonomous")) {
    section4 = "Security Trade-Offs of Autonomous AI Systems";
  } else if (conceptLower.includes("ai software")) {
    section4 = "Benefits and Limitations of AI Software Solutions";
  } else if (conceptLower.includes("digital transformation")) {
    section4 = "Benefits and Challenges of Digital Transformation";
  } else if (conceptLower.includes("workforce automation")) {
    section4 = "Benefits and Risks of Workforce Automation";
  } else if (conceptLower.includes("app development")) {
    section4 = "Benefits and Trade-Offs in App Development";
  } else {
    section4 = `Benefits and Trade-Offs of ${capitalized}`;
  }
  
  // Section 5: Business Response (replaces "Implementation and Evaluation")
  let section5: string;
  if (conceptLower.includes("startup accelerator") || conceptLower.includes("accelerator")) {
    section5 = "How Businesses Should Respond to AI Ecosystem Consolidation";
  } else if (conceptLower.includes("ai agent") || conceptLower.includes("autonomous")) {
    section5 = "Evaluating AI Agent Deployment in Enterprise Environments";
  } else if (conceptLower.includes("ai software")) {
    section5 = "How Businesses Should Evaluate AI Software Solutions";
  } else if (conceptLower.includes("digital transformation")) {
    section5 = "How Organizations Should Approach Digital Transformation";
  } else if (conceptLower.includes("workforce automation")) {
    section5 = "Decision Criteria for Workforce Automation Implementation";
  } else if (conceptLower.includes("app development")) {
    section5 = "How Businesses Should Approach App Development Projects";
  } else {
    section5 = `How Businesses Should Evaluate ${capitalized}`;
  }
  
  // Section 6: Industry Impact (make topic-specific)
  let section6: string;
  if (conceptLower.includes("startup accelerator") || conceptLower.includes("accelerator")) {
    section6 = "Impact of AI Accelerators on Startup Ecosystems";
  } else if (conceptLower.includes("ai agent") || conceptLower.includes("autonomous")) {
    section6 = "Industry Impact of Autonomous AI Agent Adoption";
  } else if (conceptLower.includes("ai software")) {
    section6 = "Industry Impact of AI Software Proliferation";
  } else if (conceptLower.includes("digital transformation")) {
    section6 = "Industry Impact of Digital Transformation Trends";
  } else if (conceptLower.includes("workforce automation")) {
    section6 = "Industry Impact of Workforce Automation";
  } else if (conceptLower.includes("app development")) {
    section6 = "Industry Impact of Modern App Development";
  } else {
    section6 = `Industry Impact of ${capitalized}`;
  }
  
  return { section2, section3, section4, section5, section6 };
}

/**
 * Remove time-sensitive references to make content evergreen
 * Preserves grammar and readability while making content timeless
 */
function makeContentEvergreen(content: string): string {
  let result = content;
  
  // Step 0: Fix broken percentage notations like "[95)" to "(95%)"
  result = result
    .replace(/\[(\d+)\)/g, '($1%)') // Fix [95) to (95%)
    .replace(/\[(\d+)\]/g, '($1%)') // Fix [95] to (95%)
    .replace(/\((\d+)\)/g, '($1%)') // Fix (95) to (95%) if not already
    .replace(/\b(\d+)\s*percent\b/gi, '$1%') // Normalize "95 percent" to "95%"
    .replace(/\b(\d+)\s*%\b/g, '$1%'); // Normalize spacing
  
  // Step 1: Normalize quotes (non-destructive)
  result = normalizeQuotes(result);
  
  // Step 2: Remove news fragments
  result = removeNewsFragments(result);
  
  // Step 3: Remove newsletter references
  result = removeNewsletterReferences(result);
  
  // Step 4: Remove time references completely (not replace with "recently")
  result = result
    .replace(/\b(this|last|next)\s+(week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/\b(today|yesterday|tomorrow)\b/gi, '')
    .replace(/\bin (2024|2025|2026)\b/gi, '')
    .replace(/\bover the (past|last) (few|several) (days|weeks|months)\b/gi, '')
    .replace(/\bthis past (week|month)\b/gi, '')
    .replace(/\bjust (announced|released|launched)\b/gi, '');
  
  // Step 5: Remove generic filler
  result = result
    .replace(/maintain competitive advantage/gi, '')
    .replace(/industry leaders recognize/gi, '')
    .replace(/essential for businesses looking to maintain competitive advantage/gi, '')
    .replace(/stay ahead of the competition/gi, '');
  
  // Step 6: First-person to third-person - preserve grammar
  result = result
    .replace(/I (discovered|found|learned) (this|that) (while|when)/gi, 'Research shows that')
    .replace(/I had (the|a|an) ([^.!?]+?)(?=\s+[A-Z]|$|\.|,|;)/gi, (match, article, rest) => {
      const restTrimmed = rest.trim();
      if (/^(monitor|access|use|configure|set|give|enable|dig|order|negotiate)/i.test(restTrimmed)) {
        const verbMatch = restTrimmed.match(/^(\w+)\s+(.+)$/);
        if (verbMatch) {
          const verb = verbMatch[1];
          const object = verbMatch[2];
          return `Organizations can use ${article} ${object} to ${verb}`;
        }
        return `Organizations can use ${article} ${rest}`;
      }
      return `Organizations have ${article} ${rest}`;
    })
    .replace(/I gave ([^.!?]+)/gi, 'Organizations can provide $1')
    .replace(/I asked ([^.!?]+)/gi, 'Organizations can request $1')
    .replace(/I tried ([^.!?]+)/gi, 'Organizations can attempt $1')
    .replace(/my (experience|testing|use)/gi, 'industry experience')
    .replace(/personal (assistant|use)/gi, 'business applications')
    .replace(/I (figured|thought|decided|wanted)/gi, 'Industry leaders')
    .replace(/I (was|am|will be)/gi, 'Organizations are');
  
  // Step 7: Cleanup broken patterns
  result = result
    .replace(/Organizations (the|a|an) ([a-z][^.!?]*?)\s+(monitor|access|use|configure|set|give|enable|dig|order|negotiate)\s+([^.!?]+)/gi, 
      (match, article, noun, verb, object) => `Organizations can use ${article} ${noun} to ${verb} ${object}`)
    .replace(/Organizations can have (the|a|an) ([a-z][^.!?]*?)\s+(monitor|access|use|configure|set|give|enable|dig|order|negotiate)\s+([^.!?]+)/gi,
      (match, article, noun, verb, object) => `Organizations can use ${article} ${noun} to ${verb} ${object}`)
    .replace(/Organizations it ([a-z][^.!?]+)/gi, 'Organizations can $1 it')
    .replace(/Organizations ([A-Z][a-z]+) to ([^.!?]+)/gi, 'Organizations can enable $1 to $2')
    .replace(/(^|\.\s+)Organizations ([a-z])/gm, (match, prefix, letter) => `${prefix}Organizations can ${letter}`)
    // Remove empty sentences and fragments
    .replace(/\.\s*\./g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();
  
  return result;
}

/**
 * Analyze content to generate dynamic, contextual headings based on the actual article topic
 */
function analyzeContentForHeadings(content: string, title: string): {
  mainSectionHeading: string;
  mainSectionContent: string[];
  secondSectionHeading: string | null;
  secondSectionContent: string[];
  includeAppDevSection: boolean;
  appDevHeading: string;
  appDevContent: string[];
  conclusionContent: string[];
} {
  const lowerContent = (content + " " + title).toLowerCase();
  const lowerTitle = title.toLowerCase();
  
  // Determine main topic and generate contextual headings
  let mainSectionHeading = "Key Insights";
  let secondSectionHeading: string | null = "Technical Analysis";
  let includeAppDevSection = true;
  let appDevHeading = "Implications for App Development";
  
  // CEO/Workplace/Company articles
  if (lowerContent.includes("ceo") || lowerContent.includes("employee") || lowerContent.includes("workplace") || 
      lowerContent.includes("company") || lowerContent.includes("workers") || lowerContent.includes("staff")) {
    mainSectionHeading = "Workplace Impact";
    secondSectionHeading = "Industry Response";
    appDevHeading = "Lessons for Tech Companies";
    includeAppDevSection = true;
  }
  // AI/Machine Learning articles
  else if (lowerContent.includes("ai") || lowerContent.includes("artificial intelligence") || 
           lowerContent.includes("machine learning") || lowerContent.includes("neural network")) {
    mainSectionHeading = "AI Innovation";
    secondSectionHeading = "Technical Deep Dive";
    appDevHeading = "AI in App Development";
    includeAppDevSection = true;
  }
  // Automation articles
  else if (lowerContent.includes("automation") || lowerContent.includes("automate") || 
           lowerContent.includes("workflow") || lowerContent.includes("process")) {
    mainSectionHeading = "Automation Advances";
    secondSectionHeading = "Implementation Strategies";
    appDevHeading = "Automation in Mobile Apps";
    includeAppDevSection = true;
  }
  // Startup/Venture articles
  else if (lowerContent.includes("startup") || lowerContent.includes("venture") || 
           lowerContent.includes("funding") || lowerContent.includes("investment")) {
    mainSectionHeading = "Startup Landscape";
    secondSectionHeading = "Market Dynamics";
    appDevHeading = "Opportunities for App Developers";
    includeAppDevSection = true;
  }
  // Web/Development articles
  else if (lowerContent.includes("web") || lowerContent.includes("development") || 
           lowerContent.includes("coding") || lowerContent.includes("programming")) {
    mainSectionHeading = "Development Trends";
    secondSectionHeading = "Technical Insights";
    appDevHeading = "Modern App Development";
    includeAppDevSection = true;
  }
  // Design/UX articles
  else if (lowerContent.includes("design") || lowerContent.includes("ui") || 
           lowerContent.includes("ux") || lowerContent.includes("user experience")) {
    mainSectionHeading = "Design Innovation";
    secondSectionHeading = "User Experience Impact";
    appDevHeading = "Design in App Development";
    includeAppDevSection = true;
  }
  // Blockchain/Web3 articles
  else if (lowerContent.includes("blockchain") || lowerContent.includes("web3") || 
           lowerContent.includes("crypto") || lowerContent.includes("defi")) {
    mainSectionHeading = "Blockchain Evolution";
    secondSectionHeading = "Decentralized Technology";
    appDevHeading = "Web3 in App Development";
    includeAppDevSection = true;
  }
  // Security/Privacy articles
  else if (lowerContent.includes("security") || lowerContent.includes("privacy") || 
           lowerContent.includes("data protection") || lowerContent.includes("cybersecurity")) {
    mainSectionHeading = "Security Considerations";
    secondSectionHeading = "Privacy Implications";
    appDevHeading = "Security in App Development";
    includeAppDevSection = true;
  }
  // Software/Tool articles
  else if (lowerContent.includes("software") || lowerContent.includes("tool") || 
           lowerContent.includes("platform") || lowerContent.includes("framework")) {
    mainSectionHeading = "Technology Overview";
    secondSectionHeading = "Key Features";
    appDevHeading = "Applications in Development";
    includeAppDevSection = true;
  }
  
  // Remove generic filler content - let source content speak for itself
  // Only use source paragraphs, no generic boilerplate
  const mainSectionContent: string[] = [];
  const secondSectionContent: string[] = [];
  const appDevContent: string[] = [];
  const conclusionContent: string[] = [];
  
  return {
    mainSectionHeading,
    mainSectionContent,
    secondSectionHeading,
    secondSectionContent,
    includeAppDevSection,
    appDevHeading,
    appDevContent,
    conclusionContent
  };
}

/**
 * Generate blog content from RSS item using code-based approach.
 * Extracts content from the source article and structures it.
 */
export async function generateBlogContent(item: RSSItem): Promise<string> {
  console.log(`[Code] Generating blog for: ${item.title}`);

  try {
    // Try to fetch and extract content and image from the source article
    const articleData = await fetchArticleContent(item.link);
    
    // Use extracted image if available
    if (articleData.imageUrl && !item.imageUrl) {
      item.imageUrl = articleData.imageUrl;
    }
    
    // Use RSS content snippet as fallback
    let sourceContent = articleData.content || item.contentSnippet || item.content || "";
    
    // Make content evergreen - remove time-sensitive references
    sourceContent = makeContentEvergreen(sourceContent);

    // Clean source content - remove markdown headings, UI elements, etc.
    let cleanContent = sourceContent
      .replace(/^##\s+[^\n]+\n\n/gm, "") // Remove markdown headings
      .replace(/^(Save Story|Share|Subscribe|Sign up|Photograph:|Photo-Illustration:)[^\n]*\n/gi, "") // Remove UI elements
      .replace(/Photo-Illustration:[^\n]*/gi, "") // Remove photo credits
      .replace(/Comment Loader[^\n]*/gi, "") // Remove comment loader
      .replace(/Save this story[^\n]*/gi, "") // Remove save story text
      .replace(/Getty Images[^\n]*/gi, "") // Remove image credits
      .replace(/WIRED Staff[^\n]*/gi, "") // Remove staff credits
      .replace(/\n{3,}/g, "\n\n") // Normalize multiple newlines
      .trim();
    
    // Structure the blog post with better content
    // First pass: filter paragraphs - only exclude clear junk
    let paragraphs = cleanContent.split(/\n\n+/).filter((p: string) => {
      const trimmed = p.trim();
      const lowerTrimmed = trimmed.toLowerCase();
      
      // Must be substantial (at least 25 chars)
      if (trimmed.length < 25) return false;
      
      // Remove markdown headings
      if (trimmed.match(/^##+\s+/)) return false;
      
      // Remove UI elements and promotional boilerplate only
      if (lowerTrimmed.match(/^(save story|share|subscribe|sign up|photograph:|photo-illustration:)/i)) return false;
      if (lowerTrimmed.includes("comment loader") || lowerTrimmed.includes("save this story") || 
          lowerTrimmed.includes("getty images") || lowerTrimmed.includes("wired staff")) return false;
      
      // Remove newsletter/promotional references
      if (/\b(subscribe|newsletter|sign up|e-newsletter|digital nation|join our)\b/i.test(trimmed)) return false;
      
      // Don't filter based on quotes, news fragments, or generic filler - use the content!
      
      return true;
    });
    
    // Filter out time-based openings (Rule 1)
    paragraphs = filterTimeBasedOpenings(paragraphs);
    
    // Extract core concept for primary keyword (Rule 3)
    const coreConcept = extractCoreConcept(sourceContent, item.title);
    
    // Remove duplicate paragraphs and sentences from source content
    // Use global sentence tracking to prevent duplicates across entire article
    const globalSeenSentences = new Set<string>();
    const seenParagraphs = new Set<string>();
    
    paragraphs = paragraphs.map((p: string) => {
      // Remove duplicate sentences within each paragraph AND across all paragraphs
      const sentences = p.split(/[.!?]+\s+/).filter(s => s.trim().length > 20);
      const uniqueSentences = sentences.filter((s: string) => {
        const normalized = s.trim().toLowerCase().replace(/\s+/g, " ").substring(0, 150); // First 150 chars as fingerprint
        if (globalSeenSentences.has(normalized)) {
          return false; // Skip duplicate sentence (already seen elsewhere)
        }
        globalSeenSentences.add(normalized);
        return true;
      });
      return uniqueSentences.join(". ") + (p.trim().endsWith(".") ? "" : ".");
    }).filter((p: string) => {
      const normalized = p.trim().toLowerCase().replace(/\s+/g, " ").substring(0, 200); // First 200 chars as fingerprint
      if (seenParagraphs.has(normalized)) {
        return false; // Skip duplicate paragraph
      }
      seenParagraphs.add(normalized);
      return true;
    });
    
    // Get more paragraphs for a comprehensive, longer article (targeting 1200-1600 words for SEO)
    // Extract more paragraphs to build depth - use all available paragraphs
    const totalParagraphs = paragraphs.length;
    const introParagraphs = paragraphs.slice(0, Math.min(3, totalParagraphs)); // 3 intro paragraphs
    const whatIsParagraphs = paragraphs.slice(3, Math.min(7, totalParagraphs)); // 4 paragraphs for main section
    const whyMattersParagraphs = paragraphs.slice(7, Math.min(11, totalParagraphs)); // 4 paragraphs
    const howWorksParagraphs = paragraphs.slice(11, Math.min(16, totalParagraphs)); // 5 paragraphs
    const bestPracticesParagraphs = paragraphs.slice(16, Math.min(20, totalParagraphs)); // 4 paragraphs
    const caseStudiesParagraphs = paragraphs.slice(20, Math.min(24, totalParagraphs)); // 4 paragraphs
    const challengesParagraphs = paragraphs.slice(24, Math.min(27, totalParagraphs)); // 3 paragraphs
    const futureParagraphs = paragraphs.slice(27, Math.min(30, totalParagraphs)); // 3 paragraphs
    const conclusionParagraphs = paragraphs.slice(30, Math.min(33, totalParagraphs)); // 3 paragraphs
    
    // Create H1 with primary keyword - written like a search query, not a news headline
    // Format: "What Is [Primary Keyword]?" or "How Does [Primary Keyword] Work?"
    const articleWord = getArticle(coreConcept);
    const capitalizedConcept = coreConcept.charAt(0).toUpperCase() + coreConcept.slice(1);
    const h1Title = `What Is ${articleWord} ${capitalizedConcept}?`;
    
    // Analyze content to generate dynamic headings based on actual article topic
    const contentAnalysis = analyzeContentForHeadings(sourceContent, item.title);
    
    // Build content sections following the rules
    // Track all paragraphs added to prevent duplicates across sections
    const addedParagraphFingerprints = new Set<string>();
    const getParagraphFingerprint = (p: string) => p.trim().toLowerCase().replace(/\s+/g, " ").substring(0, 200);
    
    // Track company mentions to limit to 15% (Rule 3)
    let totalWords = 0;
    let companyMentionWords = 0;
    
    const blogSections: string[] = [
      `# ${h1Title}`,
    ];
    
    // Rule 2: First paragraph must be a clean definition (2-3 sentences)
    // No dates, no "announced", no company names
    function createCleanDefinition(concept: string, sourceParagraphs: string[]): string {
      const conceptLower = concept.toLowerCase();
      const capitalized = concept.charAt(0).toUpperCase() + concept.slice(1);
      const articleWord = getArticle(concept);
      
      // Try to find a clean definition from source (NO company names, NO quotes, NO time refs)
      for (const p of sourceParagraphs.slice(0, 15)) {
        const lowerP = p.toLowerCase();
        
        // Must be a definition pattern
        const isDefinition = lowerP.includes("is a") || lowerP.includes("refers to") || 
                           lowerP.includes("is an") || lowerP.includes("represents") || 
                           lowerP.includes("enables") || lowerP.includes("is effectively");
        
        // Must NOT have any of these
        const hasTimeRef = /\b(announced|said|reported|revealed|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this week|recently|yesterday|today|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(p);
        const hasCompany = countCompanyMentions(p) > 0;
        const hasQuote = /"[^"]{20,}"/.test(p) || /\b(said|says|according to|told|stated|quoted|in an interview|in a statement)\b/i.test(p);
        const hasNewsFragment = /\b(announced|reported|revealed|in an interview|in a statement)\b/i.test(p);
        const hasNewsletter = /\b(subscribe|newsletter|sign up|e-newsletter)\b/i.test(p);
        
        if (isDefinition && !hasTimeRef && !hasCompany && !hasQuote && !hasNewsFragment && !hasNewsletter) {
          // Clean it up
          let clean = normalizeQuotes(p);
          clean = removeNewsFragments(clean);
          clean = removeNewsletterReferences(clean);
          clean = clean
            .replace(/\b(on|this|last|next)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|week|month|year)\b/gi, "")
            .replace(/\b(announced|said|reported|revealed)\b/gi, "")
            .replace(/\s{2,}/g, " ")
            .trim();
          
          // Ensure it mentions the concept and is 2-3 sentences
          const sentences = clean.split(/[.!?]+/).filter((s: string) => s.trim().length > 10);
          if (clean.toLowerCase().includes(conceptLower) && sentences.length >= 2 && sentences.length <= 3) {
            // Ensure primary keyword appears once
            const keywordCount = (clean.toLowerCase().match(new RegExp(conceptLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
            if (keywordCount >= 1) {
              return clean;
            }
          }
        }
      }
      
      // Fallback: Create clean definition (2-3 sentences, contains keyword once, no company)
      const definitions: Record<string, string> = {
        "startup accelerator": `${articleWord.charAt(0).toUpperCase() + articleWord.slice(1)} ${capitalized} is a program designed to help early-stage companies grow rapidly through mentorship, funding, and networking opportunities. These programs provide structured support to help startups develop their products, reach customers, and scale their operations. The accelerator model has become a standard approach for supporting innovation and entrepreneurship in technology sectors.`,
        "ai agent": `An ${capitalized} is an autonomous software system that can perform tasks, make decisions, and interact with users or other systems using artificial intelligence. These agents can understand natural language, process information, and execute actions based on their programming and learning capabilities. ${capitalized} technology enables organizations to automate complex workflows and handle tasks that previously required human intervention.`,
        "ai software": `${capitalized} refers to applications and platforms that use artificial intelligence to automate tasks, analyze data, and provide intelligent insights. This technology enables businesses to improve efficiency, make data-driven decisions, and enhance user experiences through machine learning and automation. Organizations across industries are adopting ${conceptLower} solutions to streamline operations and gain competitive advantages.`,
        "digital transformation": `${capitalized} is the process of integrating digital technology into all areas of a business to fundamentally change how it operates and delivers value to customers. This involves rethinking business models, processes, and customer engagement strategies using modern technology solutions. Successful ${conceptLower} initiatives require strategic planning, organizational change, and investment in digital infrastructure.`,
        "workforce automation": `${capitalized} involves using technology to automate repetitive tasks and processes traditionally performed by human workers. This approach helps organizations improve efficiency, reduce errors, and allow employees to focus on more strategic and creative work. Automation technologies can handle routine operations while enabling human workers to concentrate on complex problem-solving and innovation.`,
        "app development": `${capitalized} is the process of creating software applications for mobile devices, web browsers, or desktop platforms. This involves designing user interfaces, writing code, testing functionality, and deploying applications to make them available to users. Modern ${conceptLower} practices emphasize user experience, performance optimization, and cross-platform compatibility.`,
      };
      
      return definitions[conceptLower] || `${capitalized} is a technology or business approach that helps organizations achieve their goals more effectively. This concept involves strategic implementation and careful planning to deliver value and improve outcomes. Understanding ${conceptLower} principles is essential for organizations seeking to modernize their operations.`;
    }
    
    const firstParagraph = createCleanDefinition(coreConcept, paragraphs);
    blogSections.push("", firstParagraph);
    addedParagraphFingerprints.add(getParagraphFingerprint(firstParagraph));
    totalWords += firstParagraph.split(/\s+/).length;
    
    // Build 5-7 H2 sections (Rule 5)
    // Section 1: What is [Core Concept]?
    // Rule 3: First 2 paragraphs must be generic explanation; company/event examples only AFTER and clearly labeled
    blogSections.push("", `## What Is ${articleWord} ${capitalizedConcept}?`);
    
    // Find generic explanation paragraphs (no company names, no dates, no "announced")
    let paraIndex = 0;
    const genericParagraphs: string[] = [];
    const exampleParagraphs: string[] = [];
    
    for (let i = 0; i < paragraphs.length; i++) {
      const p = paragraphs[i];
      if (isGenericFiller(p)) continue;
      
      const fingerprint = getParagraphFingerprint(p);
      if (addedParagraphFingerprints.has(fingerprint)) continue;
      
      const lowerP = p.toLowerCase();
      const hasCompany = countCompanyMentions(p) > 0;
      const hasTimeRef = /\b(announced|said|reported|revealed|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|this week|recently|yesterday|today|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(p);
      
      if (hasCompany || hasTimeRef) {
        exampleParagraphs.push(p);
      } else if (genericParagraphs.length < 2) {
        genericParagraphs.push(p);
        addedParagraphFingerprints.add(fingerprint);
      }
    }
    
    // Add first 2 generic paragraphs
    for (const p of genericParagraphs.slice(0, 2)) {
      blogSections.push(p);
      totalWords += p.split(/\s+/).length;
      paraIndex++;
    }
    
    // Add example paragraphs after, clearly labeled with plain text
    // Rule: Max 2-3 sentences total for company examples
    if (exampleParagraphs.length > 0) {
      blogSections.push("", "Example:");
      let exampleSentenceCount = 0;
      const maxExampleSentences = 3;
      
      for (const p of exampleParagraphs) {
        if (exampleSentenceCount >= maxExampleSentences) break;
        
        const fingerprint = getParagraphFingerprint(p);
        if (addedParagraphFingerprints.has(fingerprint)) continue;
        
        const sentences = p.split(/[.!?]+/).filter(s => s.trim().length > 10);
        const sentencesToAdd = Math.min(sentences.length, maxExampleSentences - exampleSentenceCount);
        
        if (sentencesToAdd > 0) {
          // Take only the needed sentences
          const trimmedParagraph = sentences.slice(0, sentencesToAdd).join(". ") + ".";
          blogSections.push(trimmedParagraph);
          addedParagraphFingerprints.add(fingerprint);
          totalWords += trimmedParagraph.split(/\s+/).length;
          companyMentionWords += (countCompanyMentions(trimmedParagraph) * 10);
          exampleSentenceCount += sentencesToAdd;
          paraIndex++;
        }
      }
    }
    
    // Generate topic-specific headings (SEO-optimized, not generic)
    const headings = generateTopicSpecificHeadings(coreConcept, item.title, sourceContent);
    
    // Helper function to add paragraphs to a section ensuring minimum 2 paragraphs and 120 words
    function addSectionWithMinimums(sectionHeading: string, minParagraphs: number = 2, minWords: number = 120, required: boolean = true): boolean {
      const sectionParagraphs: string[] = [];
      let sectionWordCount = 0;
      let tempParaIndex = paraIndex;
      let attempts = 0;
      const maxAttempts = paragraphs.length * 5;
      
      // First pass: Try to collect paragraphs with minimal filtering
      while ((sectionParagraphs.length < minParagraphs || sectionWordCount < minWords) && tempParaIndex < paragraphs.length && attempts < maxAttempts) {
        attempts++;
        const p = paragraphs[tempParaIndex++];
        
        // Only exclude clear junk - be very lenient
        if (isBrokenParagraph(p)) continue; // Only skip if truly broken (< 25 chars or no sentences)
        if (/\b(subscribe|newsletter|sign up|e-newsletter|digital nation|join our|sign up for)\b/i.test(p)) continue; // Newsletter/promotional only
        if (p.trim().length < 25) continue; // Extremely short
        
        // Don't filter based on quotes or news fragments - use the content!
        
        const fingerprint = getParagraphFingerprint(p);
        if (addedParagraphFingerprints.has(fingerprint)) continue;
        
        sectionParagraphs.push(p);
        sectionWordCount += p.split(/\s+/).length;
      }
      
      // If required section and still not enough, be VERY lenient - use ANY non-junk paragraph
      if (sectionParagraphs.length < minParagraphs && required) {
        tempParaIndex = paraIndex; // Start from current position
        while (tempParaIndex < paragraphs.length && sectionParagraphs.length < minParagraphs) {
          const p = paragraphs[tempParaIndex++];
          
          // Only skip absolute junk
          if (p.trim().length < 25) continue; // Extremely short
          if (/\b(subscribe|newsletter|sign up|e-newsletter|digital nation)\b/i.test(p)) continue; // Newsletter only
          
          const fingerprint = getParagraphFingerprint(p);
          if (addedParagraphFingerprints.has(fingerprint)) continue;
          
          sectionParagraphs.push(p);
          sectionWordCount += p.split(/\s+/).length;
        }
      }
      
      // For required sections, ALWAYS add them even if below minimums (better than empty)
      if (required || sectionParagraphs.length > 0) {
        blogSections.push("", sectionHeading);
        sectionParagraphs.forEach(p => {
          blogSections.push(p);
          addedParagraphFingerprints.add(getParagraphFingerprint(p));
          totalWords += p.split(/\s+/).length;
          companyMentionWords += (countCompanyMentions(p) * 10);
        });
        paraIndex = tempParaIndex;
        
        if (sectionParagraphs.length < minParagraphs || sectionWordCount < minWords) {
          console.warn(`[Code] Section "${sectionHeading}" has only ${sectionParagraphs.length} paragraphs and ${sectionWordCount} words (min: ${minParagraphs} paragraphs, ${minWords} words)`);
        }
        return true;
      }
      
      return false;
    }
    
    // Section 2: Market/Strategic Context (topic-specific, not "Why It Matters")
    addSectionWithMinimums(`## ${headings.section2}`, 2, 120);
    
    // Section 3: Operational Mechanics (topic-specific, not "How It Works")
    addSectionWithMinimums(`## ${headings.section3}`, 2, 120);
    
    // Section 4: Benefits & Trade-Offs (topic-specific)
    addSectionWithMinimums(`## ${headings.section4}`, 2, 120);
    
    // Section 5: Business Response (topic-specific, not "Implementation and Evaluation")
    addSectionWithMinimums(`## ${headings.section5}`, 2, 120);
    
    // Section 6: Industry Impact (topic-specific, optional if we have content)
    if (paraIndex < paragraphs.length) {
      addSectionWithMinimums(`## ${headings.section6}`, 2, 120);
    }
    
    // Section 7: Future Outlook (optional, if we have content)
    if (paraIndex < paragraphs.length) {
      addSectionWithMinimums("## Future Outlook", 2, 120);
    }
    
    // Check company mention limit (Rule 3 - max 15%)
    const companyPercentage = totalWords > 0 ? (companyMentionWords / totalWords) * 100 : 0;
    if (companyPercentage > 15) {
      console.warn(`[Code] Warning: Company mentions are ${companyPercentage.toFixed(1)}% of content (target: <15%). Consider reducing company-specific content.`);
    }

    let blogContent = blogSections.join("\n\n");
    let wordCount = blogContent.split(/\s+/).length;

    // If content is too short, expand it by adding more analysis and context
    // Target: 1200-1500 words minimum for SEO
    const targetMinWords = 1200;
    const targetMaxWords = 1500;
    
    /**
     * Merge thin sections (below minimums) with adjacent sections to avoid empty headings
     */
    function mergeSectionsIfThin(sections: string[]): string[] {
      const merged: string[] = [];
      let i = 0;
      
      while (i < sections.length) {
        const current = sections[i];
        
        // Check if this is a heading
        if (current.trim().startsWith("##")) {
          const heading = current.trim();
          const headingIndex = i;
          const sectionContent: string[] = [];
          let sectionWordCount = 0;
          let j = i + 1;
          
          // Collect content until next heading
          while (j < sections.length && !sections[j].trim().startsWith("##")) {
            const para = sections[j].trim();
            if (para && para.length > 25) {
              sectionContent.push(para);
              sectionWordCount += para.split(/\s+/).length;
            }
            j++;
          }
          
          // Check if section is thin (below minimums)
          const isThin = sectionContent.length < 2 || sectionWordCount < 120;
          
          if (isThin && merged.length > 0) {
            // Merge with previous section instead of adding heading
            console.warn(`[Code] Merging thin section "${heading}" with previous section`);
            sectionContent.forEach(p => merged.push(p));
            i = j; // Skip to next section
            continue;
          } else {
            // Add heading and content
            merged.push(heading);
            sectionContent.forEach(p => merged.push(p));
            i = j;
            continue;
          }
        } else {
          // Regular paragraph, add it
          merged.push(current);
          i++;
        }
      }
      
      return merged;
    }
    
    if (wordCount < targetMinWords) {
      let sections = blogContent.split(/\n\n+/);
      
      // Add more paragraphs from source if available
      if (paragraphs.length > paraIndex) {
        const additionalParagraphs = paragraphs.slice(paraIndex);
        if (additionalParagraphs.length > 0) {
          const conclusionIndex = sections.findIndex(s => s.trim().startsWith("## Summary") || s.trim().startsWith("## Conclusion") || s.trim().startsWith("## Future Outlook"));
          const insertIndex = conclusionIndex > 0 ? conclusionIndex : sections.length;
          
          // Filter and add unused paragraphs
          const existingFingerprints = new Set<string>();
          sections.forEach(s => {
            if (s.trim() && !s.trim().startsWith("##")) {
              existingFingerprints.add(getParagraphFingerprint(s.trim()));
            }
          });
          
          const newParagraphs = additionalParagraphs.filter(p => {
            if (isBrokenParagraph(p)) return false;
            if (/\b(subscribe|newsletter|sign up|e-newsletter|digital nation)\b/i.test(p)) return false;
            const fingerprint = getParagraphFingerprint(p);
            if (existingFingerprints.has(fingerprint)) return false;
            existingFingerprints.add(fingerprint);
            return true;
          });
          
          if (newParagraphs.length > 0) {
            sections.splice(insertIndex, 0, "", ...newParagraphs);
            blogContent = sections.join("\n\n");
            wordCount = blogContent.split(/\s+/).length;
          }
        }
      }
      
      // Merge thin sections to avoid empty headings
      if (wordCount < targetMinWords) {
        sections = blogContent.split(/\n\n+/);
        const merged = mergeSectionsIfThin(sections);
        blogContent = merged.join("\n\n");
        wordCount = blogContent.split(/\s+/).length;
      }
      
      // If still short, use ALL remaining source paragraphs
      if (wordCount < targetMinWords) {
        // Find a good place to insert additional content (before conclusion, or at end if no conclusion)
        let insertIndex = sections.findIndex(s => s.trim().startsWith("## Summary") || s.trim().startsWith("## Conclusion") || s.trim().startsWith("## Strategic Outlook"));
        if (insertIndex < 0) {
          insertIndex = sections.length; // Insert at end if no conclusion found
        }
        
        // Track existing content to avoid duplicates
        const existingContent = new Set<string>();
        sections.forEach(s => {
          if (s.trim() && !s.trim().startsWith("##")) {
            existingContent.add(s.trim().toLowerCase().substring(0, 200)); // First 200 chars as fingerprint
          }
        });
        
        let currentWordCount = wordCount;
        const targetWords = targetMinWords;
        
        // Strategy 1: Use ALL remaining source paragraphs (prioritize source content over filler)
        if (currentWordCount < targetWords) {
          const expandedSections: string[] = [];
          let expandedWordCount = 0;
          
          // Track which paragraphs from source have been used
          const usedParagraphIndices = new Set<number>();
          sections.forEach(s => {
            if (s.trim() && !s.trim().startsWith("##")) {
              paragraphs.forEach((p, idx) => {
                const fingerprint = p.trim().toLowerCase().substring(0, 200);
                if (s.trim().toLowerCase().substring(0, 200) === fingerprint) {
                  usedParagraphIndices.add(idx);
                }
              });
            }
          });
          
          // Get all unused source paragraphs
          const remainingParagraphs = paragraphs
            .map((p, idx) => ({ p, idx }))
            .filter(({ p, idx }) => {
              if (usedParagraphIndices.has(idx)) return false;
              const fingerprint = p.trim().toLowerCase().substring(0, 200);
              if (existingContent.has(fingerprint)) return false;
              existingContent.add(fingerprint);
              return true;
            })
            .map(({ p }) => p);
          
          // Add remaining paragraphs from source
          if (remainingParagraphs.length > 0) {
            expandedSections.push(...remainingParagraphs);
            remainingParagraphs.forEach(p => {
              expandedWordCount += p.split(/\s+/).length;
            });
          }
          
          // Strategy 2: If still short, try to get more paragraphs from the original source content
          if (currentWordCount + expandedWordCount < targetWords && sourceContent) {
            const additionalParagraphs = getAdditionalSourceParagraphs(
              sourceContent,
              existingContent,
              Math.ceil((targetWords - currentWordCount - expandedWordCount) / 50) // Estimate paragraphs needed
            );
            
            if (additionalParagraphs.length > 0) {
              expandedSections.push(...additionalParagraphs);
              additionalParagraphs.forEach(p => {
                expandedWordCount += p.split(/\s+/).length;
              });
            }
          }
          
          // Insert additional content before conclusion
          if (expandedSections.length > 0) {
            sections.splice(insertIndex, 0, "", ...expandedSections);
            blogContent = sections.join("\n\n");
            currentWordCount = blogContent.split(/\s+/).length;
          }
        }
        
        wordCount = currentWordCount;
      }
    }

    console.log(`[Code] Generated ${wordCount} words from source content.`);
    return blogContent;
  } catch (error: any) {
    console.warn(`[Code] Failed to fetch article content, using RSS snippet: ${error.message}`);
    
    // Fallback: Use RSS content snippet with comprehensive structure
    let fallbackContent = item.contentSnippet || item.content || item.title;
    // Make content evergreen
    fallbackContent = makeContentEvergreen(fallbackContent);
    const mainHeading = item.title || "Latest Technology Developments";
    
    // Analyze content for dynamic headings
    const contentAnalysis = analyzeContentForHeadings(fallbackContent, item.title);
    
    // Extract more paragraphs from RSS content for comprehensive article
    const rssParagraphs = (item.contentSnippet || item.content || "")
      .replace(/<[^>]+>/g, " ") // Remove HTML tags
      .split(/\n\n+/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 100)
      .slice(0, 40); // Extract up to 40 paragraphs for longer content
    
    const blogSections: string[] = [
      `## ${mainHeading}`,
    ];
    
    if (rssParagraphs.length > 0) {
      blogSections.push(...rssParagraphs.slice(0, 3));
      blogSections.push("", `## ${contentAnalysis.mainSectionHeading}`);
      blogSections.push(...rssParagraphs.slice(3, 6));
      if (contentAnalysis.secondSectionHeading) {
        blogSections.push("", `## ${contentAnalysis.secondSectionHeading}`);
        blogSections.push(...rssParagraphs.slice(6, 9));
      }
    } else {
      blogSections.push(fallbackContent);
      blogSections.push("This development has significant implications for the technology industry and how businesses approach digital transformation.");
      blogSections.push("The integration of new technologies and methodologies is reshaping how organizations operate and compete in the digital marketplace.");
      blogSections.push("", `## ${contentAnalysis.mainSectionHeading}`);
      blogSections.push(...contentAnalysis.mainSectionContent);
      if (contentAnalysis.secondSectionHeading) {
        blogSections.push("", `## ${contentAnalysis.secondSectionHeading}`);
        blogSections.push(...contentAnalysis.secondSectionContent);
      }
    }
    
    if (contentAnalysis.includeAppDevSection && rssParagraphs.length > 9) {
      blogSections.push("", `## ${contentAnalysis.appDevHeading}`);
      blogSections.push(...rssParagraphs.slice(9, Math.min(12, rssParagraphs.length)));
    }
    
    if (rssParagraphs.length > 12) {
      blogSections.push("", "## Summary");
      blogSections.push(...rssParagraphs.slice(12, Math.min(15, rssParagraphs.length)));
    }
    
    return blogSections.join("\n\n");
  }
}
