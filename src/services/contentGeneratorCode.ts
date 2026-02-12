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
 * Remove time-sensitive references to make content evergreen
 * Preserves grammar and readability while making content timeless
 */
function makeContentEvergreen(content: string): string {
  return content
    // Time references - make generic
    .replace(/this (week|month|year|past week|past month)/gi, 'recently')
    .replace(/(today|yesterday|last (week|month|year))/gi, 'recently')
    .replace(/in (2024|2025|2026)/gi, 'recently')
    .replace(/over the (past|last) (few|several) (days|weeks|months)/gi, 'recently')
    .replace(/this past (week|month)/gi, 'recently')
    .replace(/just (announced|released|launched)/gi, 'announced')
    // First-person to third-person - preserve grammar
    .replace(/I (discovered|found|learned) (this|that) (while|when)/gi, 'Research shows that')
    .replace(/I had (the|a|an) ([^.!?]+)/gi, 'Organizations have $1 $2')
    .replace(/I gave ([^.!?]+)/gi, 'Organizations provide $1')
    .replace(/I asked ([^.!?]+)/gi, 'Organizations can request $1')
    .replace(/I tried ([^.!?]+)/gi, 'Organizations can attempt $1')
    // Personal references - make professional
    .replace(/my (experience|testing|use)/gi, 'industry experience')
    .replace(/personal (assistant|use)/gi, 'business applications')
    // Remove overly personal statements that break flow
    .replace(/I (figured|thought|decided|wanted)/gi, 'Industry leaders')
    .replace(/I (was|am|will be)/gi, 'Organizations are')
    // Fix any remaining broken "Organizations" patterns
    .replace(/Organizations ([a-z])/g, (match, letter) => `Organizations ${letter.toUpperCase()}`)
    .replace(/Organizations the ([^.!?]+)/gi, 'Organizations can $1')
    .replace(/Organizations it ([^.!?]+)/gi, 'Organizations can provide $1')
    .replace(/Organizations ([A-Z][a-z]+) to ([^.!?]+)/gi, 'Organizations can enable $1 to $2');
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
    // First pass: filter paragraphs
    let paragraphs = cleanContent.split(/\n\n+/).filter((p: string) => {
      const trimmed = p.trim();
      // Filter out very short paragraphs, markdown headings, and UI elements
      // Require at least 100 characters for substantial paragraphs (2-4 lines)
      const lowerTrimmed = trimmed.toLowerCase();
      return trimmed.length > 100 
        && !trimmed.match(/^##+\s+/) 
        && !lowerTrimmed.match(/^(save story|share|subscribe|sign up|photograph:|photo-illustration:)/i)
        && !lowerTrimmed.includes("comment loader")
        && !lowerTrimmed.includes("save this story")
        && !lowerTrimmed.includes("getty images")
        && !lowerTrimmed.includes("wired staff");
    });
    
    // Remove duplicate paragraphs from source content
    const seenParagraphs = new Set<string>();
    paragraphs = paragraphs.map((p: string) => {
      // Also remove duplicate sentences within each paragraph
      const sentences = p.split(/[.!?]+\s+/).filter(s => s.trim().length > 20);
      const seenSentences = new Set<string>();
      const uniqueSentences = sentences.filter((s: string) => {
        const normalized = s.trim().toLowerCase().replace(/\s+/g, " ");
        if (seenSentences.has(normalized)) {
          return false; // Skip duplicate sentence
        }
        seenSentences.add(normalized);
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
    
    // Use RSS title for the main heading, or create a descriptive one
    const mainHeading = item.title || "Latest Technology Developments";
    
    // Analyze content to generate dynamic headings based on actual article topic
    const contentAnalysis = analyzeContentForHeadings(sourceContent, item.title);
    
    // Build comprehensive content sections for SEO dominance (3000-4000 words)
    // Track all paragraphs added to prevent duplicates across sections
    const addedParagraphFingerprints = new Set<string>();
    const getParagraphFingerprint = (p: string) => p.trim().toLowerCase().replace(/\s+/g, " ").substring(0, 200);
    
    const blogSections: string[] = [
      `## ${mainHeading}`,
    ];
    
    // Introduction section (300-500 words)
    blogSections.push("", "## Introduction");
    if (introParagraphs.length > 0) {
      introParagraphs.forEach(p => {
        const fingerprint = getParagraphFingerprint(p);
        if (!addedParagraphFingerprints.has(fingerprint)) {
          blogSections.push(p);
          addedParagraphFingerprints.add(fingerprint);
        }
      });
    } else {
      const snippet = item.contentSnippet || item.content || "";
      if (snippet.length > 50) {
        blogSections.push(snippet);
        blogSections.push("This development has significant implications for the technology industry and how businesses approach digital transformation.");
        blogSections.push("Understanding these changes is crucial for staying ahead in an increasingly competitive technological environment.");
      } else {
        blogSections.push(`The recent developments in ${mainHeading.toLowerCase()} represent a significant shift in the technology landscape.`);
        blogSections.push("This article provides a comprehensive analysis of what this means for businesses, developers, and the industry as a whole.");
      }
    }
    
    // Main section - avoid generic "What is" phrasing
    blogSections.push("", `## ${contentAnalysis.mainSectionHeading}`);
    if (whatIsParagraphs.length > 0) {
      whatIsParagraphs.forEach(p => {
        const fingerprint = getParagraphFingerprint(p);
        if (!addedParagraphFingerprints.has(fingerprint)) {
          blogSections.push(p);
          addedParagraphFingerprints.add(fingerprint);
        }
      });
    } else {
      blogSections.push(contentAnalysis.mainSectionContent[0]);
      blogSections.push("This development represents a significant advancement in the technology sector, with far-reaching implications for businesses and consumers alike.");
      blogSections.push("The integration of new technologies and methodologies is reshaping how organizations operate and compete in the digital marketplace.");
    }
    
    // Second main section - avoid generic phrasing and prevent duplicates
    if (contentAnalysis.secondSectionHeading) {
      blogSections.push("", `## ${contentAnalysis.secondSectionHeading}`);
      if (whyMattersParagraphs.length > 0) {
        whyMattersParagraphs.forEach(p => {
          const fingerprint = getParagraphFingerprint(p);
          if (!addedParagraphFingerprints.has(fingerprint)) {
            blogSections.push(p);
            addedParagraphFingerprints.add(fingerprint);
          }
        });
      } else {
        blogSections.push(contentAnalysis.mainSectionContent[1]);
        blogSections.push("Organizations that adapt quickly to these changes are better positioned to leverage new opportunities and maintain their competitive edge.");
        blogSections.push("The evolving technology landscape presents both challenges and opportunities for businesses seeking to innovate.");
      }
      
      // Only add howWorksParagraphs if they're different from whyMattersParagraphs
      if (howWorksParagraphs.length > 0) {
        howWorksParagraphs.forEach(p => {
          const fingerprint = getParagraphFingerprint(p);
          if (!addedParagraphFingerprints.has(fingerprint)) {
            blogSections.push(p);
            addedParagraphFingerprints.add(fingerprint);
          }
        });
      }
    }
    
    // Best Practices section - only if we have content (check for duplicates)
    if (bestPracticesParagraphs.length > 0 || caseStudiesParagraphs.length > 0) {
      blogSections.push("", "## Implementation Strategies");
      if (bestPracticesParagraphs.length > 0) {
        bestPracticesParagraphs.forEach(p => {
          const fingerprint = getParagraphFingerprint(p);
          if (!addedParagraphFingerprints.has(fingerprint)) {
            blogSections.push(p);
            addedParagraphFingerprints.add(fingerprint);
          }
        });
      }
      if (caseStudiesParagraphs.length > 0) {
        caseStudiesParagraphs.forEach(p => {
          const fingerprint = getParagraphFingerprint(p);
          if (!addedParagraphFingerprints.has(fingerprint)) {
            blogSections.push(p);
            addedParagraphFingerprints.add(fingerprint);
          }
        });
      }
    }
    
    // Common Challenges section - only if we have content (check for duplicates)
    if (challengesParagraphs.length > 0) {
      blogSections.push("", "## Key Considerations");
      challengesParagraphs.forEach(p => {
        const fingerprint = getParagraphFingerprint(p);
        if (!addedParagraphFingerprints.has(fingerprint)) {
          blogSections.push(p);
          addedParagraphFingerprints.add(fingerprint);
        }
      });
    }
    
    // Future section - only if we have content (check for duplicates)
    if (futureParagraphs.length > 0) {
      blogSections.push("", `## Industry Outlook`);
      futureParagraphs.forEach(p => {
        const fingerprint = getParagraphFingerprint(p);
        if (!addedParagraphFingerprints.has(fingerprint)) {
          blogSections.push(p);
          addedParagraphFingerprints.add(fingerprint);
        }
      });
    }
    
    // App Development implications (only if relevant and we have actual content)
    if (contentAnalysis.includeAppDevSection) {
      // Use remaining paragraphs for app dev section instead of empty appDevContent
      const appDevParagraphs = paragraphs.slice(33, Math.min(38, paragraphs.length));
      if (appDevParagraphs.length > 0) {
        blogSections.push("", `## ${contentAnalysis.appDevHeading}`);
        appDevParagraphs.forEach(p => {
          const fingerprint = getParagraphFingerprint(p);
          if (!addedParagraphFingerprints.has(fingerprint)) {
            blogSections.push(p);
            addedParagraphFingerprints.add(fingerprint);
          }
        });
      }
    }
    
    // Conclusion section - use actual content, avoid generic phrasing (check for duplicates)
    if (conclusionParagraphs.length > 0) {
      blogSections.push("", "## Summary");
      conclusionParagraphs.forEach(p => {
        const fingerprint = getParagraphFingerprint(p);
        if (!addedParagraphFingerprints.has(fingerprint)) {
          blogSections.push(p);
          addedParagraphFingerprints.add(fingerprint);
        }
      });
    } else if (paragraphs.length > 0) {
      // Use remaining paragraphs instead of generic conclusion
      const remainingParagraphs = paragraphs.slice(38, Math.min(42, paragraphs.length));
      if (remainingParagraphs.length > 0) {
        blogSections.push("", "## Summary");
        remainingParagraphs.forEach(p => {
          const fingerprint = getParagraphFingerprint(p);
          if (!addedParagraphFingerprints.has(fingerprint)) {
            blogSections.push(p);
            addedParagraphFingerprints.add(fingerprint);
          }
        });
      }
    }

    let blogContent = blogSections.join("\n\n");
    let wordCount = blogContent.split(/\s+/).length;

    // If content is too short, expand it by adding more analysis and context
    // Target: 800 words minimum (practical for SEO without being too restrictive)
    if (wordCount < 800) {
      const sections = blogContent.split(/\n\n+/);
      
      // Add more paragraphs from source if available
      if (paragraphs.length > 33) {
        const additionalParagraphs = paragraphs.slice(33, Math.min(50, paragraphs.length));
        if (additionalParagraphs.length > 0) {
          const conclusionIndex = sections.findIndex(s => s.trim().startsWith("## Summary") || s.trim().startsWith("## Conclusion"));
          if (conclusionIndex > 0) {
            sections.splice(conclusionIndex, 0, "", ...additionalParagraphs);
            blogContent = sections.join("\n\n");
            wordCount = blogContent.split(/\s+/).length;
          }
        }
      }
      
      // If still short, add more from source paragraphs (NO generic filler)
      if (wordCount < 800) {
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
        const targetWords = 800;
        
        // Use ALL remaining source paragraphs - be more aggressive
        // Check what paragraphs we've already used
        const usedParagraphIndices = new Set<number>();
        sections.forEach(s => {
          if (s.trim() && !s.trim().startsWith("##")) {
            // Find which paragraph this matches
            paragraphs.forEach((p, idx) => {
              const fingerprint = p.trim().toLowerCase().substring(0, 200);
              if (s.trim().toLowerCase().substring(0, 200) === fingerprint) {
                usedParagraphIndices.add(idx);
              }
            });
          }
        });
        
        // Get ALL unused paragraphs
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
        
        // Add all remaining paragraphs until we reach target
        if (remainingParagraphs.length > 0 && currentWordCount < targetWords) {
          // Add all remaining paragraphs
          sections.splice(insertIndex, 0, "", ...remainingParagraphs);
          blogContent = sections.join("\n\n");
          currentWordCount = blogContent.split(/\s+/).length;
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
