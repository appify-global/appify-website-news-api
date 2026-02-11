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
            .filter((t) => t.length > 50 && !t.match(/^(Save Story|Share|Subscribe|Sign up)/i)) // Filter out very short paragraphs and UI elements
            .slice(0, 20) // Take first 20 paragraphs
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
  
  // Generate contextual content based on headings
  const mainSectionContent = [
    "This development represents a significant advancement in the technology sector, with far-reaching implications for businesses and consumers alike.",
    "The integration of new technologies and methodologies is reshaping how organizations operate and compete in the digital marketplace.",
    "Understanding these changes is crucial for staying ahead in an increasingly competitive technological environment."
  ];
  
  const secondSectionContent = [
    "From a technical perspective, this development highlights the importance of staying current with emerging technologies and industry best practices.",
    "Organizations that adapt quickly to these changes are better positioned to leverage new opportunities and maintain their competitive edge."
  ];
  
  const appDevContent = [
    "This development highlights the importance of staying current with technological advances in the app development space.",
    "For businesses looking to build or enhance their mobile applications, understanding these trends is crucial for maintaining competitive advantage.",
    "The evolving technology landscape presents both challenges and opportunities for app developers and businesses seeking to innovate."
  ];
  
  const conclusionContent = [
    "This news underscores the evolving landscape of technology and its impact on app development practices.",
    "Staying informed about these changes helps businesses make better decisions about their technology investments.",
    "As the industry continues to evolve, organizations that embrace innovation and adapt to new technologies will be best positioned for long-term success."
  ];
  
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
    const sourceContent = articleData.content || item.contentSnippet || item.content || "";

    // Clean source content - remove markdown headings, UI elements, etc.
    let cleanContent = sourceContent
      .replace(/^##\s+[^\n]+\n\n/gm, "") // Remove markdown headings
      .replace(/^(Save Story|Share|Subscribe|Sign up|Photograph:)[^\n]*\n/gi, "") // Remove UI elements
      .replace(/\n{3,}/g, "\n\n") // Normalize multiple newlines
      .trim();
    
    // Structure the blog post with better content
    const paragraphs = cleanContent.split(/\n\n+/).filter((p: string) => {
      const trimmed = p.trim();
      // Filter out very short paragraphs, markdown headings, and UI elements
      // Require at least 100 characters for substantial paragraphs (2-4 lines)
      return trimmed.length > 100 
        && !trimmed.match(/^##+\s+/) 
        && !trimmed.match(/^(Save Story|Share|Subscribe|Sign up|Photograph:)/i);
    });
    
    // Get more paragraphs for a longer article
    const introParagraphs = paragraphs.slice(0, 3); // 3 intro paragraphs
    const bodyParagraphs = paragraphs.slice(3, 8); // 5 body paragraphs
    const additionalParagraphs = paragraphs.slice(8, 12); // 4 more paragraphs
    const conclusionParagraphs = paragraphs.slice(12, 15); // 3 conclusion paragraphs
    
    // Use RSS title for the main heading, or create a descriptive one
    const mainHeading = item.title || "Latest Technology Developments";
    
    // Analyze content to generate dynamic headings based on actual article topic
    const contentAnalysis = analyzeContentForHeadings(sourceContent, item.title);
    
    // Build comprehensive content sections
    const blogSections: string[] = [
      `## ${mainHeading}`,
    ];
    
    // Introduction section with multiple paragraphs
    if (introParagraphs.length > 0) {
      blogSections.push(...introParagraphs);
    } else {
      // Fallback: use RSS content snippet and expand it
      const snippet = item.contentSnippet || item.content || "";
      if (snippet.length > 50) {
        blogSections.push(snippet);
        blogSections.push("This development has significant implications for the technology industry and how businesses approach digital transformation.");
      } else {
        blogSections.push(`The recent developments in ${mainHeading.toLowerCase()} represent a significant shift in the technology landscape.`);
      }
    }
    
    // Dynamic heading based on content analysis
    blogSections.push("", `## ${contentAnalysis.mainSectionHeading}`);
    
    // Main section with multiple paragraphs
    if (bodyParagraphs.length > 0) {
      blogSections.push(...bodyParagraphs);
    } else {
      blogSections.push(contentAnalysis.mainSectionContent[0]);
      blogSections.push(contentAnalysis.mainSectionContent[1]);
      blogSections.push(contentAnalysis.mainSectionContent[2]);
    }
    
    // Second dynamic section
    if (contentAnalysis.secondSectionHeading) {
      blogSections.push("", `## ${contentAnalysis.secondSectionHeading}`);
      
      if (additionalParagraphs.length > 0) {
        blogSections.push(...additionalParagraphs);
      } else {
        blogSections.push(contentAnalysis.secondSectionContent[0]);
        blogSections.push(contentAnalysis.secondSectionContent[1]);
      }
    }
    
    // App Development implications (only if relevant)
    if (contentAnalysis.includeAppDevSection) {
      blogSections.push("", `## ${contentAnalysis.appDevHeading}`);
      blogSections.push(contentAnalysis.appDevContent[0]);
      blogSections.push(contentAnalysis.appDevContent[1]);
      blogSections.push(contentAnalysis.appDevContent[2]);
    }
    
    blogSections.push("", "## Conclusion");
    
    // Conclusion with multiple paragraphs
    if (conclusionParagraphs.length > 0) {
      blogSections.push(...conclusionParagraphs);
    } else {
      blogSections.push(contentAnalysis.conclusionContent[0]);
      blogSections.push(contentAnalysis.conclusionContent[1]);
      blogSections.push(contentAnalysis.conclusionContent[2]);
    }

    const blogContent = blogSections.join("\n\n");
    const wordCount = blogContent.split(/\s+/).length;

    console.log(`[Code] Generated ${wordCount} words from source content.`);
    return blogContent;
  } catch (error: any) {
    console.warn(`[Code] Failed to fetch article content, using RSS snippet: ${error.message}`);
    
    // Fallback: Use RSS content snippet with comprehensive structure
    const fallbackContent = item.contentSnippet || item.content || item.title;
    const mainHeading = item.title || "Latest Technology Developments";
    
    // Analyze content for dynamic headings
    const contentAnalysis = analyzeContentForHeadings(fallbackContent, item.title);
    
    // Extract paragraphs from RSS content if available
    const rssParagraphs = (item.contentSnippet || item.content || "")
      .replace(/<[^>]+>/g, " ") // Remove HTML tags
      .split(/\n\n+/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 100)
      .slice(0, 10);
    
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
    
    if (contentAnalysis.includeAppDevSection) {
      blogSections.push("", `## ${contentAnalysis.appDevHeading}`);
      blogSections.push(...contentAnalysis.appDevContent);
    }
    
    blogSections.push("", "## Conclusion");
    blogSections.push(...contentAnalysis.conclusionContent);
    
    return blogSections.join("\n\n");
  }
}
