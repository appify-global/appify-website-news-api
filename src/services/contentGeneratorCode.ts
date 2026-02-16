import { RSSItem } from "./rss";
import https from "https";
import http from "http";
import { URL } from "url";

/**
 * Extract main content and image from an article URL using basic HTML parsing.
 */
export async function fetchArticleContent(url: string): Promise<{ content: string; imageUrl?: string }> {
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
          // Extract image from meta tags (og:image, twitter:image, or first img tag)
          let imageUrl: string | undefined;
          
          // Try og:image first (most common)
          const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
          if (ogImageMatch && ogImageMatch[1]) {
            imageUrl = ogImageMatch[1];
          }
          
          // Try twitter:image if og:image not found
          if (!imageUrl) {
            const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
            if (twitterImageMatch && twitterImageMatch[1]) {
              imageUrl = twitterImageMatch[1];
            }
          }
          
          // Try first img tag in article/main content if meta tags not found
          if (!imageUrl) {
            const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
            const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
            const contentArea = articleMatch?.[1] || mainMatch?.[1] || html;
            
            const imgMatch = contentArea.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
            if (imgMatch && imgMatch[1]) {
              imageUrl = imgMatch[1];
              // Make relative URLs absolute
              if (imageUrl.startsWith("/")) {
                imageUrl = `${parsedUrl.protocol}//${parsedUrl.host}${imageUrl}`;
              } else if (imageUrl.startsWith("//")) {
                imageUrl = `${parsedUrl.protocol}${imageUrl}`;
              }
            }
          }
          
          // Extract text content
          const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
          const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
          const contentMatch = html.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

          let content = articleMatch?.[1] || mainMatch?.[1] || contentMatch?.[1] || html;

          content = content.replace(/<script[\s\S]*?<\/script>/gi, "");
          content = content.replace(/<style[\s\S]*?<\/style>/gi, "");

          const paragraphs = content.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || [];
          let text = paragraphs
            .map((p) => p.replace(/<[^>]+>/g, " ").trim())
            .filter((t) => t.length > 50)
            .slice(0, 30)
            .join("\n\n");

          // Clean up standalone quotes from extracted HTML content
          if (!text) {
            text = content.replace(/<[^>]+>/g, " ").slice(0, 5000);
          }
          
          // Remove standalone quote marks
          text = text.replace(/\s+["']\s+/g, ' ');
          text = text.replace(/\s+["']/g, '');
          text = text.replace(/["']\s+/g, ' ');

          resolve({
            content: text,
            imageUrl,
          });
        });
      })
      .on("error", reject);
  });
}

/**
 * Simple hash function for deterministic selection
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a clean definition paragraph for SEO with dynamic contextual sentence
 */
function generateDefinition(coreConcept: string, titleContext?: string): string {
  const article = /^[aeiou]/i.test(coreConcept) ? "an" : "a";
  const capitalized = coreConcept.charAt(0).toUpperCase() + coreConcept.slice(1);
  
  const definitions: Record<string, string> = {
    "ai agent": `${capitalized} is ${article} autonomous software system that can perform tasks, make decisions, and interact with users or other systems using artificial intelligence. These agents can understand natural language, process information, and execute actions based on their programming and learning capabilities. AI agent technology enables organizations to automate complex workflows and handle tasks that previously required human intervention.`,
    "startup accelerator": `${capitalized} is ${article} program designed to help early-stage companies grow rapidly through mentorship, funding, and networking opportunities. These programs provide structured support to help startups develop their products, reach customers, and scale their operations. The accelerator model has become a standard approach for supporting innovation and entrepreneurship in technology sectors.`,
    "ai software": `${capitalized} refers to applications and platforms that use artificial intelligence to automate tasks, analyze data, and provide intelligent insights. This technology enables businesses to improve efficiency, make data-driven decisions, and enhance user experiences through machine learning and automation. Organizations across industries are adopting AI software solutions to streamline operations and gain competitive advantages.`,
    "digital transformation": `${capitalized} is the process of integrating digital technology into all areas of a business to fundamentally change how it operates and delivers value to customers. This involves rethinking business models, processes, and customer engagement strategies using modern technology solutions. Successful digital transformation initiatives require strategic planning, organizational change, and investment in digital infrastructure.`,
    "workforce automation": `${capitalized} involves using technology to automate repetitive tasks and processes traditionally performed by human workers. This approach helps organizations improve efficiency, reduce errors, and allow employees to focus on more strategic and creative work. Automation technologies can handle routine operations while enabling human workers to concentrate on complex problem-solving and innovation.`,
  };
  
  const conceptLower = coreConcept.toLowerCase();
  const baseDefinition = definitions[conceptLower] || `${capitalized} is ${article} ${coreConcept} system or strategy used by organizations to improve efficiency, automate processes, and support decision-making through technology. It plays an increasingly important role in modern enterprise environments where digital transformation is accelerating.`;
  
  // Use titleContext to add topic-flavored sentence
  const context = (titleContext || "").toLowerCase();
  let contextLine = "";
  
  if (context.includes("finance") || context.includes("bank") || context.includes("insurance") || context.includes("financial")) {
    contextLine = `This is especially relevant in financial services, where automation and compliance requirements drive adoption.`;
  } else if (context.includes("health") || context.includes("hospital") || context.includes("medical")) {
    contextLine = `In healthcare, these systems are often used to reduce administrative load and improve service workflows.`;
  } else if (context.includes("retail") || context.includes("ecommerce") || context.includes("commerce")) {
    contextLine = `Retail and e-commerce organizations use these technologies to enhance customer experiences and optimize inventory management.`;
  } else if (context.includes("manufacturing") || context.includes("production") || context.includes("factory")) {
    contextLine = `Manufacturing companies leverage these systems to improve production efficiency and quality control processes.`;
  } else if (context.includes("education") || context.includes("school") || context.includes("university")) {
    contextLine = `Educational institutions are adopting these technologies to streamline administrative tasks and support learning outcomes.`;
  } else {
    contextLine = `Adoption is typically driven by the need to scale operations without scaling headcount at the same rate.`;
  }
  
  return `${baseDefinition} ${contextLine}`;
}

/**
 * Extract core concept from title/content
 */
function extractCoreConcept(title: string, content: string): string {
  const lower = (title + " " + content).toLowerCase();
  
  if (lower.includes("ai agent") || lower.includes("ai agents")) return "ai agent";
  if (lower.includes("startup accelerator") || lower.includes("accelerator")) return "startup accelerator";
  if (lower.includes("ai software")) return "ai software";
  if (lower.includes("digital transformation")) return "digital transformation";
  if (lower.includes("workforce automation") || lower.includes("workplace automation")) return "workforce automation";
  if (lower.includes("app development")) return "app development";
  
  return "technology";
}

/**
 * Classify paragraphs by meaning instead of slicing by index
 */
function groupParagraphs(paragraphs: string[]): {
  benefits: string[];
  implementation: string[];
  future: string[];
  general: string[];
} {
  const benefits: string[] = [];
  const implementation: string[] = [];
  const future: string[] = [];
  const general: string[] = [];

  paragraphs.forEach(p => {
    const lower = p.toLowerCase();

    if (lower.includes("benefit") || lower.includes("improve") || lower.includes("efficiency") || 
        lower.includes("advantage") || lower.includes("value") || lower.includes("impact")) {
      benefits.push(p);
    } else if (lower.includes("deploy") || lower.includes("implement") || lower.includes("integrat") ||
               lower.includes("adopt") || lower.includes("strategy") || lower.includes("approach")) {
      implementation.push(p);
    } else if (lower.includes("future") || lower.includes("trend") || lower.includes("outlook") ||
               lower.includes("evolve") || lower.includes("emerging")) {
      future.push(p);
    } else {
      general.push(p);
    }
  });

  return { benefits, implementation, future, general };
}

/**
 * Merge fallback content when a section is too thin
 */
function mergeIfThin(section: string[], fallback: string[]): string[] {
  const wordCount = section.join(" ").split(/\s+/).length;
  if (wordCount < 120 && fallback.length > 0) {
    return [...section, ...fallback.slice(0, 1)];
  }
  return section;
}

/**
 * Enforce minimum word count per section - use more source content instead of generic filler
 */
function ensureMinimumWords(section: string[], minWords = 150, coreConcept: string = "this technology", titleOrUrl: string = "", sourceContent?: string, usedContent?: Set<string>): string[] {
  let wordCount = section.join(" ").split(/\s+/).length;
  if (wordCount >= minWords) return section;

  // Helper to check if content is already used
  const isContentUsed = (text: string): boolean => {
    if (!usedContent) return false;
    const key = text.substring(0, 50).toLowerCase();
    return Array.from(usedContent).some(used => used.includes(key) || key.includes(used));
  };

  // Try to extract more content from source instead of using generic filler
  if (sourceContent && sourceContent.length > 100) {
    const sentences = sourceContent.split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => {
        const lower = s.toLowerCase();
        // Avoid attribution, quotes, very short sentences, and already used content
        return s.length > 60 && 
               !lower.includes("said") && 
               !lower.includes("according") &&
               !lower.includes("quoted") &&
               !section.some(existing => existing.includes(s.substring(0, 30))) && // Avoid duplicates in this section
               !isContentUsed(s); // Avoid duplicates across all sections
      })
      .slice(0, 3); // Get up to 3 more sentences
    
    if (sentences.length > 0) {
      const additionalContent = sentences.map(s => expandPoint(s, titleOrUrl.split(' ')[0] || coreConcept, coreConcept));
      const newWordCount = [...section, ...additionalContent].join(" ").split(/\s+/).length;
      if (newWordCount >= minWords * 0.6) { // If we get to 60% of target, that's good enough
        return [...section, ...additionalContent];
      }
    }
  }

  // Only use generic filler as last resort, and make it more unique per section
  // Use a combination of section identifier and content length for more variety
  const sectionHash = simpleHash(titleOrUrl + section.length + section.join('').length);
  const mainTopic = titleOrUrl.split(/[:,-]/)[0]?.trim() || coreConcept;
  
  // More varied, topic-specific fillers - expanded list
  const fillers = [
    `The ${mainTopic} landscape continues to evolve with new developments and applications emerging regularly.`,
    `Understanding the technical requirements and implementation considerations is essential for successful adoption of ${mainTopic}.`,
    `Organizations exploring ${mainTopic} should evaluate how it aligns with their specific operational needs and strategic goals.`,
    `The practical applications of ${mainTopic} extend across various use cases and industry sectors.`,
    `Effective implementation of ${mainTopic} requires careful planning and consideration of integration requirements.`,
    `As ${mainTopic} technology advances, new capabilities and features become available to organizations.`,
    `The benefits of ${mainTopic} can be realized through strategic deployment and proper configuration.`,
    `Organizations should assess their readiness and infrastructure requirements before adopting ${mainTopic}.`,
    `The ${mainTopic} ecosystem includes various tools, platforms, and services that support different use cases.`,
    `Successful integration of ${mainTopic} depends on understanding both technical and organizational factors.`,
    `Companies implementing ${mainTopic} solutions often see improvements in efficiency and operational effectiveness.`,
    `The adoption of ${mainTopic} requires evaluating both short-term benefits and long-term strategic value.`,
    `Organizations considering ${mainTopic} should review case studies and industry best practices.`,
    `The ${mainTopic} market is characterized by rapid innovation and continuous technological advancement.`,
    `Effective use of ${mainTopic} involves understanding its capabilities and limitations.`,
  ];
  
  // Try different fillers until we find one that hasn't been used
  let fillerIndex = sectionHash % fillers.length;
  let attempts = 0;
  let filler = fillers[fillerIndex];
  
  while (isContentUsed(filler) && attempts < fillers.length) {
    fillerIndex = (fillerIndex + 1) % fillers.length;
    filler = fillers[fillerIndex];
    attempts++;
  }
  
  // Only add one filler sentence, not multiple
  return section.concat(filler);
}

/**
 * Clean content: remove quotes and fix notation, but keep original structure
 */
function cleanContent(content: string): string {
  let cleaned = content;
  
  // Remove quote marks but keep content (matched pairs first)
  cleaned = cleaned.replace(/"([^"]{20,})"/g, '$1');
  cleaned = cleaned.replace(/'([^']{20,})'/g, '$1');
  
  // Remove standalone quote marks (not part of matched pairs)
  // Remove quotes that are alone or at word boundaries
  cleaned = cleaned.replace(/\s+["']\s+/g, ' '); // Standalone quotes with spaces
  cleaned = cleaned.replace(/\s+["']/g, ''); // Trailing quotes
  cleaned = cleaned.replace(/["']\s+/g, ' '); // Leading quotes
  cleaned = cleaned.replace(/^["']+|["']+$/g, ''); // Quotes at start/end of string
  
  // Remove attribution phrases
  cleaned = cleaned.replace(/\s+(said|says|according to|told|stated|quoted|in an interview|in a statement)\s*[.!?]/gi, '.');
  cleaned = cleaned.replace(/\([^)]*\b(said|says|according to|told|stated|quoted)\b[^)]*\)/gi, '');
  
  // Fix percentage notation [95) to (95%)
  cleaned = cleaned.replace(/\[(\d+)\)/g, '($1%)');
  
  // Remove incomplete sentences starting with "As" (standalone)
  cleaned = cleaned.replace(/^As\s+[^.!?]{0,60}\.\s*$/gm, '');
  
  // Remove standalone names/pronouns
  cleaned = cleaned.replace(/^\s*([A-Z][a-z]+|she|he|they|it)\s*\.\s*$/gm, '');
  
  // Clean up extra spaces and remove any remaining standalone punctuation
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  cleaned = cleaned.replace(/\s+["']\s+/g, ' '); // One more pass for standalone quotes
  
  return cleaned;
}

/**
 * Generate unique SEO-friendly headings based on RSS article title and content
 * Creates headings that are specific to each article, not generic templates
 */
function getDynamicHeadings(rssTitle: string, coreConcept: string, rssContent?: string): {
  h1: string;
  section1: string;
  section2: string;
  section3: string;
  section4: string;
} {
  const titleLower = rssTitle.toLowerCase();
  const contentLower = (rssContent || "").toLowerCase();
  
  // Use RSS title as H1
  let h1 = rssTitle;
  
  // Extract key nouns and topics from title for unique headings
  const titleWords = rssTitle.split(/\s+/).filter(w => w.length > 3);
  const importantWords = titleWords.filter(w => {
    const lower = w.toLowerCase();
    return !['the', 'and', 'for', 'with', 'from', 'that', 'this', 'what', 'when', 'where', 'how', 'why'].includes(lower);
  });
  
  // Generate unique headings based on actual article content
  let section1: string;
  let section2: string;
  let section3: string;
  let section4: string;
  
  // Extract main topic from title (first significant noun phrase)
  const mainTopic = importantWords.slice(0, 3).join(' ') || rssTitle.split(':')[0] || rssTitle.split('-')[0];
  
  // Extract SEO keywords and specific concepts from title and content
  const seoKeywords: string[] = [];
  if (titleLower.includes("ai agent") || titleLower.includes("ai agents")) seoKeywords.push("AI Agents");
  if (titleLower.includes("startup") || titleLower.includes("startups")) seoKeywords.push("Startups");
  if (titleLower.includes("app development") || titleLower.includes("app dev")) seoKeywords.push("App Development");
  if (titleLower.includes("artificial intelligence") || titleLower.includes("ai")) seoKeywords.push("AI");
  if (titleLower.includes("automation")) seoKeywords.push("Automation");
  if (titleLower.includes("technology")) seoKeywords.push("Technology");
  
  // Extract specific entities or platforms mentioned
  const entities: string[] = [];
  if (titleLower.includes("rentahuman") || titleLower.includes("rent a human")) entities.push("RentAHuman");
  if (titleLower.includes("openai")) entities.push("OpenAI");
  if (titleLower.includes("anthropic")) entities.push("Anthropic");
  if (titleLower.includes("a16z") || titleLower.includes("andreessen")) entities.push("a16z");
  
  // Combine keywords for use in headings
  const keywordPhrase = seoKeywords.length > 0 ? seoKeywords.join(" and ") : mainTopic;
  const entityPhrase = entities.length > 0 ? entities.join(" and ") : null;
  
  // Generate unique headings based on what the article is actually about
  if (titleLower.includes("tried") || titleLower.includes("i tried")) {
    // First-person experience articles
    const subject = entityPhrase || (titleLower.includes("rentahuman") ? "RentAHuman" : 
                    titleLower.includes("ai agent") ? "AI Agents" : mainTopic);
    section1 = `What Is ${subject} and How Does It Work?`;
    section2 = `${subject} Features: Key Capabilities and Functionality`;
    section3 = `Real-World ${subject} Applications and User Experience`;
    section4 = `The Future of ${subject}: Implications and Industry Impact`;
  } else if (titleLower.includes("review") || titleLower.includes("test")) {
    section1 = `What Is ${mainTopic}?`;
    section2 = `${mainTopic} Features: Key Capabilities and Performance`;
    section3 = `${mainTopic} User Experience and Practical Applications`;
    section4 = `${mainTopic} Verdict: Final Recommendations and Considerations`;
  } else if (titleLower.includes("scam") || titleLower.includes("safe") || titleLower.includes("security") || titleLower.includes("risk") || titleLower.includes("protect")) {
    section1 = `${mainTopic} Security: Understanding the Risks and Implications`;
    section2 = `${mainTopic} Vulnerabilities: Key Threats and Attack Vectors`;
    section3 = `${mainTopic} Protection: Best Practices and Security Measures`;
    section4 = `Staying Safe with ${mainTopic}: Future Security Considerations`;
  } else if (titleLower.includes("company") || titleLower.includes("companies") || titleLower.includes("business")) {
    section1 = `How Companies Are Leveraging ${mainTopic} for Business Growth`;
    section2 = `${mainTopic} Benefits: Strategic Advantages and ROI`;
    section3 = `${mainTopic} Implementation: Approaches, Challenges, and Solutions`;
    section4 = `The Future of ${mainTopic} in Business: Trends and Predictions`;
  } else if (titleLower.includes("guide") || titleLower.includes("how to") || titleLower.includes("best practices") || titleLower.includes("tips")) {
    section1 = `Getting Started with ${mainTopic}: Essential Concepts`;
    section2 = `${mainTopic} Fundamentals: Core Principles and Best Practices`;
    section3 = `${mainTopic} Implementation: Step-by-Step Guide and Strategies`;
    section4 = `Advanced ${mainTopic} Techniques: Optimization and Pro Tips`;
  } else if (titleLower.includes("future") || titleLower.includes("trend") || titleLower.includes("outlook") || titleLower.includes("predict")) {
    section1 = `The Current State of ${mainTopic}: Where We Are Today`;
    section2 = `${mainTopic} Trends: Emerging Developments and Innovations`;
    section3 = `${mainTopic} Impact: Strategic Implications for Organizations`;
    section4 = `The Future of ${mainTopic}: Predictions and Long-Term Outlook`;
  } else if (titleLower.includes("kills") || titleLower.includes("deal") || titleLower.includes("uproar") || titleLower.includes("news")) {
    // News/event articles
    section1 = `The ${mainTopic} Story: What Happened and Why It Matters`;
    section2 = `${mainTopic} Details: Key Facts, Context, and Background`;
    section3 = `${mainTopic} Impact: Industry Reactions and Implications`;
    section4 = `After ${mainTopic}: What This Means for the Future`;
  } else if (titleLower.includes("gear") || titleLower.includes("equipment") || titleLower.includes("hardware")) {
    section1 = `${mainTopic} Technology: How It Works and What Makes It Special`;
    section2 = `${mainTopic} Features: Key Innovations and Technical Specifications`;
    section3 = `${mainTopic} Applications: Real-World Use Cases and Performance`;
    section4 = `The Future of ${mainTopic}: Upcoming Developments and Trends`;
  } else if (titleLower.includes("ai") || titleLower.includes("artificial intelligence")) {
    // Make AI headings more specific to the actual topic
    if (titleLower.includes("olympic") || titleLower.includes("sports")) {
      section1 = `How AI and Technology Are Transforming ${mainTopic}`;
      section2 = `Innovative Applications in Sports and Performance`;
      section3 = `Technical Implementation and Design`;
      section4 = `Future of Technology-Enhanced Athletics`;
    } else if (titleLower.includes("tried") || titleLower.includes("tested") || titleLower.includes("experience")) {
      // Experience-based AI articles
      const aiSubject = entityPhrase || keywordPhrase;
      section1 = `What Is ${aiSubject} and How Does It Work?`;
      section2 = `${aiSubject} Features: Key Capabilities and Functionality`;
      section3 = `${aiSubject} Applications: Real-World Use Cases and User Experience`;
      section4 = `The Future of ${aiSubject}: Implications and Industry Outlook`;
    } else if (titleLower.includes("agent") || titleLower.includes("agents")) {
      const agentPhrase = entityPhrase || "AI Agents";
      section1 = `What Are ${agentPhrase} and How Do They Function?`;
      section2 = `${agentPhrase} Capabilities: Key Features and Applications`;
      section3 = `${agentPhrase} Implementation: Integration Strategies and Best Practices`;
      section4 = `The Future of ${agentPhrase}: Evolution and Industry Impact`;
    } else if (titleLower.includes("app development") || titleLower.includes("app dev")) {
      section1 = `The Fundamentals of ${mainTopic}`;
      section2 = `${mainTopic} Technologies: Development Approaches and Tools`;
      section3 = `${mainTopic} Implementation: Strategies, Best Practices, and Case Studies`;
      section4 = `The Future of ${mainTopic}: Trends in AI-Powered Application Development`;
    } else if (titleLower.includes("hired") || titleLower.includes("joins") || titleLower.includes("leaves")) {
      // People/company movement in AI
      const movementPhrase = entityPhrase || mainTopic;
      section1 = `The ${movementPhrase} Development: What You Need to Know`;
      section2 = `${movementPhrase} Context: Key Players, Background, and Industry Dynamics`;
      section3 = `${movementPhrase} Impact: Strategic Implications and Market Effects`;
      section4 = `After ${movementPhrase}: What This Means for the AI Industry`;
    } else if (titleLower.includes("overview") || titleLower.includes("overviews")) {
      section1 = `${mainTopic}: Core Concepts and How It Works`;
      section2 = `${mainTopic} Considerations: Risks, Limitations, and Challenges`;
      section3 = `${mainTopic} Best Practices: Safe Usage and Optimization Strategies`;
      section4 = `The Future of ${mainTopic}: Improvements and Upcoming Developments`;
    } else {
      // More specific AI headings - avoid generic "Understanding"
      const titlePhrase = rssTitle.split(/[:,-]/)[0]?.trim() || mainTopic;
      const aiKeyword = keywordPhrase || mainTopic;
      section1 = `${titlePhrase}: Key Concepts and Applications`;
      section2 = `${aiKeyword} Capabilities: Core Features and Functionality`;
      section3 = `${aiKeyword} Implementation: Considerations, Strategies, and Best Practices`;
      section4 = `The Future of ${aiKeyword}: Outlook and Industry Evolution`;
    }
  } else {
    // Generate more specific headings - avoid generic "Understanding"
    // Try to extract a more specific phrase from the title
    const titlePhrase = rssTitle.split(/[:,-]/)[0]?.trim() || mainTopic;
    
    // Check for specific patterns in title
    if (titleLower.includes("tried") || titleLower.includes("tested")) {
      section1 = `What Is ${titlePhrase} and How Does It Work?`;
      section2 = `${titlePhrase} Features: Key Capabilities and Functionality`;
      section3 = `${titlePhrase} Applications: Real-World Use Cases and Performance`;
      section4 = `The Future of ${titlePhrase}: Implications and Industry Outlook`;
    } else if (titleLower.includes("hired") || titleLower.includes("joins") || titleLower.includes("leaves")) {
      section1 = `The ${titlePhrase} Development: What You Need to Know`;
      section2 = `${titlePhrase} Context: Key Players, Background, and Industry Dynamics`;
      section3 = `${titlePhrase} Impact: Strategic Implications and Market Effects`;
      section4 = `After ${titlePhrase}: What This Means for the Industry`;
    } else {
      const keyword = keywordPhrase || titlePhrase;
      section1 = `${titlePhrase}: Key Concepts and Overview`;
      section2 = `${keyword} Features: Important Capabilities and Benefits`;
      section3 = `${keyword} Implementation: Practical Applications and Strategies`;
      section4 = `The Future of ${keyword}: Trends and Developments`;
    }
  }
  
  return { h1, section1, section2, section3, section4 };
}

/**
 * Ensure paragraphs are 2-3 sentences minimum
 */
function ensureParagraphLength(paragraph: string): string {
  const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 10);
  
  if (sentences.length < 2) {
    return paragraph; // Will be handled in grouping
  }
  
  if (sentences.length <= 3) {
    return sentences.join('. ') + '.';
  }
  
  return sentences.slice(0, 3).join('. ') + '.';
}

/**
 * Generate topic-specific content based on RSS article title
 */
function generateTopicSpecificContent(rssTitle: string, rssContent: string, coreConcept: string): {
  definition: string;
  section1: string[];
  section2: string[];
  section3: string[];
  section4: string[];
} {
  const titleLower = rssTitle.toLowerCase();
  const contentLower = (rssContent || "").toLowerCase();
  const combined = titleLower + " " + contentLower;
  
  // Generate topic-specific definition based on RSS title
  let definition = "";
  if (titleLower.includes("scam") || titleLower.includes("safe") || titleLower.includes("security") || titleLower.includes("risk")) {
    definition = `Understanding security risks and safety measures is crucial when adopting new technologies. ${rssTitle} highlights important considerations that organizations must address to protect their operations and users. This topic requires careful evaluation of potential vulnerabilities and implementation of appropriate safeguards.`;
  } else if (titleLower.includes("company") || titleLower.includes("companies") || titleLower.includes("business")) {
    definition = `The landscape of ${coreConcept} continues to evolve as companies explore new applications and strategies. ${rssTitle} reflects current trends and developments in how organizations are leveraging these technologies. Understanding these patterns helps businesses make informed decisions about adoption and implementation.`;
  } else if (titleLower.includes("guide") || titleLower.includes("how to") || titleLower.includes("best practices")) {
    definition = `Effective implementation of ${coreConcept} requires understanding key principles and best practices. ${rssTitle} provides valuable insights into how organizations can successfully adopt and integrate these technologies. This guide covers essential considerations for achieving optimal results.`;
  } else if (titleLower.includes("future") || titleLower.includes("trend") || titleLower.includes("outlook")) {
    definition = `The future of ${coreConcept} is shaped by emerging trends and technological advances. ${rssTitle} explores how these developments will impact organizations and industries. Understanding these trends helps businesses prepare for upcoming changes and opportunities.`;
  } else {
    definition = `${rssTitle} represents an important development in ${coreConcept}. This topic addresses key considerations that organizations should understand when evaluating and implementing related technologies. Understanding these aspects is essential for making informed strategic decisions.`;
  }
  
  // Generate topic-specific sections based on RSS content
  const section1: string[] = [];
  const section2: string[] = [];
  const section3: string[] = [];
  const section4: string[] = [];
  
  // Extract key points from RSS content and expand them
  const keyPoints = extractKeyPoints(rssContent, rssTitle);
  
  // Section 1: How it works / Understanding the topic - use RSS content
  if (keyPoints.length > 0) {
    section1.push(expandPoint(keyPoints[0] || `Understanding ${rssTitle}`, rssTitle, coreConcept));
    if (keyPoints.length > 1) {
      section1.push(expandPoint(keyPoints[1], rssTitle, coreConcept));
    }
    if (keyPoints.length > 2) {
      section1.push(expandPoint(keyPoints[2], rssTitle, coreConcept));
    }
  } else {
    // Generate topic-specific content based on RSS title
    const titleWords = rssTitle.toLowerCase();
    if (titleWords.includes("scam") || titleWords.includes("safe") || titleWords.includes("security")) {
      section1.push(`${rssTitle} highlights critical security considerations that organizations must address. Understanding these risks and implementing appropriate safeguards is essential for protecting operations and users. This requires careful evaluation of potential vulnerabilities and proactive measures to mitigate threats.`);
    } else if (titleWords.includes("company") || titleWords.includes("companies")) {
      section1.push(`${rssTitle} reflects current trends in how organizations are leveraging ${coreConcept}. Understanding these patterns helps businesses make informed decisions about adoption and implementation strategies. Companies are exploring new applications and approaches to gain competitive advantages.`);
    } else {
      section1.push(`${rssTitle} represents an important development in ${coreConcept}. Understanding this topic requires examining how these technologies function in real-world environments and the implications for organizations. This knowledge forms the foundation for successful implementation and strategic decision-making.`);
    }
  }
  
  // Section 2: Benefits / Applications - use actual RSS content when available
  const titleWords = rssTitle.toLowerCase();
  
  // Try to extract actual benefits/features from RSS content first
  const benefitSentences = rssContent.split(/[.!?]+/).filter(s => {
    const lower = s.toLowerCase();
    return (lower.includes("benefit") || lower.includes("advantage") || lower.includes("feature") || 
            lower.includes("capability") || lower.includes("improve") || lower.includes("enhance")) &&
           s.trim().length > 50;
  }).slice(0, 2);
  
  if (benefitSentences.length > 0) {
    section2.push(...benefitSentences.map(s => expandPoint(s.trim(), rssTitle, coreConcept)));
  } else if (titleWords.includes("scam") || titleWords.includes("safe") || titleWords.includes("security")) {
    section2.push(`Addressing the security concerns highlighted in ${rssTitle} provides organizations with essential protection mechanisms. Implementing appropriate safety measures helps prevent potential threats and vulnerabilities. These safeguards become critical as organizations scale their operations and handle sensitive data.`);
  } else if (titleWords.includes("company") || titleWords.includes("companies")) {
    section2.push(`The developments discussed in ${rssTitle} offer significant benefits for organizations exploring ${coreConcept}. Companies can achieve improved efficiency, enhanced capabilities, and better strategic positioning through informed adoption. These advantages become more significant as organizations integrate these technologies into their core business processes.`);
  } else {
    // Use more specific content from RSS if available
    const relevantContent = rssContent.split(/[.!?]+/).filter(s => {
      const lower = s.toLowerCase();
      return !lower.includes("said") && !lower.includes("according") && s.trim().length > 60;
    }).slice(0, 1);
    
    if (relevantContent.length > 0) {
      section2.push(expandPoint(relevantContent[0].trim(), rssTitle, coreConcept));
    } else {
      section2.push(`The benefits of ${coreConcept} extend across multiple dimensions of organizational operations. Companies can achieve improved efficiency, enhanced decision-making capabilities, and better resource utilization through strategic implementation. These advantages become more significant as organizations scale their adoption and integrate these technologies into core business processes.`);
    }
  }
  
  // Section 3: Implementation / Strategy - extract from RSS content when possible
  const implementationSentences = rssContent.split(/[.!?]+/).filter(s => {
    const lower = s.toLowerCase();
    return (lower.includes("implement") || lower.includes("deploy") || lower.includes("use") || 
            lower.includes("approach") || lower.includes("strategy") || lower.includes("method")) &&
           s.trim().length > 50;
  }).slice(0, 2);
  
  if (implementationSentences.length > 0) {
    section3.push(...implementationSentences.map(s => expandPoint(s.trim(), rssTitle, coreConcept)));
  } else if (titleWords.includes("scam") || titleWords.includes("safe") || titleWords.includes("security")) {
    section3.push(`Implementing the safety measures discussed in ${rssTitle} requires a structured approach that addresses technical, organizational, and strategic considerations. Organizations should begin by clearly defining security objectives, assessing current vulnerabilities, and identifying protection mechanisms. This planning phase is critical for ensuring comprehensive protection and minimizing risks.`);
  } else if (titleWords.includes("guide") || titleWords.includes("how to")) {
    section3.push(`Following the guidance in ${rssTitle} requires a structured approach that addresses technical, organizational, and strategic considerations. Organizations should begin by clearly defining objectives, assessing current capabilities, and identifying implementation steps. This planning phase is critical for ensuring successful adoption and maximizing value from the investment.`);
  } else {
    // Use more content from RSS
    const relevantContent = rssContent.split(/[.!?]+/).filter(s => {
      const lower = s.toLowerCase();
      return !lower.includes("said") && !lower.includes("according") && s.trim().length > 60;
    }).slice(1, 2);
    
    if (relevantContent.length > 0) {
      section3.push(expandPoint(relevantContent[0].trim(), rssTitle, coreConcept));
    } else {
      section3.push(`Implementing ${coreConcept} successfully requires a structured approach that addresses technical, organizational, and strategic considerations. Organizations should begin by clearly defining objectives, assessing current capabilities, and identifying integration points with existing systems. This planning phase is critical for ensuring smooth deployment and maximizing value from the investment.`);
    }
  }
  
  // Section 4: Considerations / Future - make it topic-specific
  if (titleWords.includes("future") || titleWords.includes("trend") || titleWords.includes("outlook")) {
    section4.push(`As discussed in ${rssTitle}, the future of ${coreConcept} is shaped by emerging trends and technological advances. Organizations must stay informed about these developments to prepare for upcoming changes and opportunities. The landscape evolves rapidly, requiring continuous awareness and strategic adaptation.`);
  } else {
    section4.push(`As ${coreConcept} continues to evolve, organizations must stay informed about emerging trends and best practices. The landscape changes rapidly, with new capabilities and applications emerging regularly. Companies that maintain awareness of these developments position themselves to adapt quickly and capitalize on new opportunities as they arise.`);
  }
  
  return { definition, section1, section2, section3, section4 };
}

/**
 * Extract key points from RSS content
 */
function extractKeyPoints(content: string, title: string): string[] {
  const points: string[] = [];
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  // Extract sentences that seem important (contain key terms)
  const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  sentences.forEach(sentence => {
    const lower = sentence.toLowerCase();
    const hasTitleWords = titleWords.some(word => lower.includes(word));
    if (hasTitleWords && sentence.trim().length > 50) {
      points.push(sentence.trim());
    }
  });
  
  return points.slice(0, 5); // Return up to 5 key points
}

/**
 * Expand a key point into a full paragraph
 * Uses less generic filler, preserves more of the original content
 */
function expandPoint(point: string, rssTitle: string, coreConcept: string): string {
  // Remove quotes and attribution
  let expanded = point.replace(/^["']+|["']+$/g, "").trim();
  
  // Remove standalone quote marks
  expanded = expanded.replace(/\s+["']\s+/g, ' ');
  expanded = expanded.replace(/\s+["']/g, '');
  expanded = expanded.replace(/["']\s+/g, ' ');
  
  // Remove attribution phrases that make content generic
  expanded = expanded.replace(/\s+(said|says|according to|told|stated|quoted|in an interview|in a statement)\s*[.!?]/gi, '.');
  expanded = expanded.replace(/\([^)]*\b(said|says|according to|told|stated|quoted)\b[^)]*\)/gi, '');
  
  // DON'T add generic filler - just return the cleaned point as-is
  // If it's too short, that's okay - better than generic filler
  // The ensureMinimumWords function will handle adding content if needed
  
  // Final cleanup of any remaining standalone quotes
  expanded = expanded.replace(/\s+["']\s+/g, ' ').trim();
  
  return expanded;
}

/**
 * Generate blog content from RSS item using code-based approach.
 * Creates structured, topic-specific content that matches the RSS article.
 */
export async function generateBlogContent(item: RSSItem): Promise<string> {
  console.log(`[Code] Generating blog for: ${item.title}`);

  try {
    const articleData = await fetchArticleContent(item.link);
    const sourceContent = articleData.content || item.contentSnippet || item.content || "";
    
    // Set imageUrl if extracted from article page
    if (articleData.imageUrl && !item.imageUrl) {
      item.imageUrl = articleData.imageUrl;
      console.log(`[Code] Extracted image from article page: ${articleData.imageUrl}`);
    }
    
    // Extract core concept for dynamic headings
    const coreConcept = extractCoreConcept(item.title, sourceContent);
    const headings = getDynamicHeadings(item.title, coreConcept, sourceContent); // Pass RSS title and content for unique headings
    
    // Generate topic-specific content based on RSS article
    const topicContent = generateTopicSpecificContent(item.title, sourceContent, coreConcept);
    
    // Clean and process source content
    let cleaned = cleanContent(sourceContent);
    const paragraphs = cleaned.split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 50)
      .map(p => ensureParagraphLength(p))
      .filter(p => {
        if (/^As\s+[^.!?]{0,60}\.\s*$/.test(p)) return false;
        if (/^([A-Z][a-z]+|she|he|they|it)\s*\.\s*$/.test(p)) return false;
        return true;
      });
    
    // Classify paragraphs by meaning
    const grouped = groupParagraphs(paragraphs);
    
    // Merge topic-specific content with extracted content
    const titleOrUrl = item.title + item.link;
    
    // Track all used content across sections to prevent duplicates
    const usedContent: Set<string> = new Set();
    
    // Helper to check if content is already used
    const isContentUsed = (text: string): boolean => {
      const key = text.substring(0, 50).toLowerCase();
      return Array.from(usedContent).some(used => used.includes(key) || key.includes(used));
    };
    
    // Helper to mark content as used
    const markAsUsed = (text: string) => {
      usedContent.add(text.substring(0, 50).toLowerCase());
    };
    
    // Section 1: Prioritize extracted content over generic templates
    let section1Content: string[] = [];
    // Use actual extracted content first - get more content
    if (grouped.general.length > 0) {
      const generalContent = grouped.general.filter(p => !isContentUsed(p)).slice(0, 5);
      section1Content.push(...generalContent);
      generalContent.forEach(markAsUsed);
    }
    // Only add template content if we don't have enough real content
    if (section1Content.length === 0) {
      section1Content = [...topicContent.section1];
    } else if (section1Content.join(' ').split(/\s+/).length < 150) {
      // Add one template paragraph only if needed
      section1Content.push(...topicContent.section1.slice(0, 1));
    }
    section1Content = ensureMinimumWords(section1Content, 200, coreConcept, titleOrUrl + "section1", sourceContent, usedContent);
    section1Content.forEach(markAsUsed);
    
    // Section 2: Prioritize extracted content - use more from source
    let section2Content: string[] = [];
    if (grouped.benefits.length > 0) {
      const benefitsContent = grouped.benefits.filter(p => !isContentUsed(p)).slice(0, 5);
      section2Content.push(...benefitsContent);
      benefitsContent.forEach(markAsUsed);
    }
    // Also use general content if benefits are limited
    if (section2Content.length < 2 && grouped.general.length > 0) {
      const additionalGeneral = grouped.general.filter(p => !isContentUsed(p)).slice(0, 2);
      section2Content.push(...additionalGeneral);
      additionalGeneral.forEach(markAsUsed);
    }
    if (section2Content.length === 0) {
      section2Content = [...topicContent.section2];
    } else if (section2Content.join(' ').split(/\s+/).length < 150) {
      section2Content.push(...topicContent.section2.slice(0, 1));
    }
    section2Content = ensureMinimumWords(section2Content, 200, coreConcept, titleOrUrl + "section2", sourceContent, usedContent);
    section2Content.forEach(markAsUsed);
    
    // Section 3: Prioritize extracted content - use more from source
    let section3Content: string[] = [];
    if (grouped.implementation.length > 0) {
      const implementationContent = grouped.implementation.filter(p => !isContentUsed(p)).slice(0, 5);
      section3Content.push(...implementationContent);
      implementationContent.forEach(markAsUsed);
    }
    // Also use general content if implementation is limited
    if (section3Content.length < 2 && grouped.general.length > 2) {
      const additionalGeneral = grouped.general.filter(p => !isContentUsed(p)).slice(0, 2);
      section3Content.push(...additionalGeneral);
      additionalGeneral.forEach(markAsUsed);
    }
    if (section3Content.length === 0) {
      section3Content = [...topicContent.section3];
    } else if (section3Content.join(' ').split(/\s+/).length < 150) {
      section3Content.push(...topicContent.section3.slice(0, 1));
    }
    section3Content = ensureMinimumWords(section3Content, 200, coreConcept, titleOrUrl + "section3", sourceContent, usedContent);
    section3Content.forEach(markAsUsed);
    
    // Section 4: Prioritize extracted content - use more from source
    let section4Content: string[] = [];
    if (grouped.future.length > 0) {
      const futureContent = grouped.future.filter(p => !isContentUsed(p)).slice(0, 5);
      section4Content.push(...futureContent);
      futureContent.forEach(markAsUsed);
    } else if (grouped.general.length > 4) {
      const additionalGeneral = grouped.general.filter(p => !isContentUsed(p)).slice(0, 4);
      section4Content.push(...additionalGeneral);
      additionalGeneral.forEach(markAsUsed);
    }
    if (section4Content.length === 0) {
      section4Content = [...topicContent.section4];
    } else if (section4Content.join(' ').split(/\s+/).length < 150) {
      section4Content.push(...topicContent.section4.slice(0, 1));
    }
    section4Content = ensureMinimumWords(section4Content, 200, coreConcept, titleOrUrl + "section4", sourceContent, usedContent);
    section4Content.forEach(markAsUsed);
    
    // Build blog structure with topic-specific content
    const blogSections: string[] = [
      `# ${headings.h1}`,
      "",
      topicContent.definition,
      "",
      `## ${headings.section1}`,
      ...section1Content.filter(p => p.length > 0),
      "",
      `## ${headings.section2}`,
      ...section2Content.filter(p => p.length > 0),
      "",
      `## ${headings.section3}`,
      ...section3Content.filter(p => p.length > 0),
      "",
      `## ${headings.section4}`,
      ...section4Content.filter(p => p.length > 0),
    ];

    const blogContent = blogSections.join("\n\n");
    const wordCount = blogContent.split(/\s+/).length;

    console.log(`[Code] Generated ${wordCount} words (topic-specific content matching RSS article).`);
    return blogContent;
  } catch (error: any) {
    console.warn(`[Code] Failed to fetch article content, using RSS snippet: ${error.message}`);
    
    // Fallback: Generate topic-specific content from RSS snippet
    const fallbackContent = item.contentSnippet || item.content || item.title;
    const coreConcept = extractCoreConcept(item.title, fallbackContent);
    const headings = getDynamicHeadings(item.title, coreConcept, fallbackContent); // Pass RSS title and content for unique headings
    const topicContent = generateTopicSpecificContent(item.title, fallbackContent, coreConcept);
    
    return `# ${headings.h1}\n\n${topicContent.definition}\n\n## ${headings.section1}\n\n${topicContent.section1.join("\n\n")}\n\n## ${headings.section2}\n\n${topicContent.section2.join("\n\n")}\n\n## ${headings.section3}\n\n${topicContent.section3.join("\n\n")}\n\n## ${headings.section4}\n\n${topicContent.section4.join("\n\n")}`;
  }
}
