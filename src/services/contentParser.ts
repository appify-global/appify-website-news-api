import slugify from "slugify";

interface ContentBlock {
  type: "paragraph" | "heading" | "subheading" | "image";
  text?: string;
  src?: string;
  alt?: string;
}

/**
 * Parse SEO-optimized HTML/markdown blog content into structured content blocks
 * that match the frontend's ArticleContentBlock format.
 */
export function parseContentBlocks(htmlContent: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  const lines = htmlContent.split("\n").filter((line) => line.trim());
  let lastBlockType: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Heading: <h2>...</h2> (main heading)
    if (trimmed.match(/^<h2[^>]*>/i)) {
      let text = trimmed.replace(/<\/?h2[^>]*>/gi, "").trim();
      text = text.replace(/<[^>]+>/g, "").trim();
      if (text) {
        if (lastBlockType !== "heading" && lastBlockType !== "subheading") {
          blocks.push({ type: "heading", text });
          lastBlockType = "heading";
        }
      }
      continue;
    }

    // Subheading: <h3>...</h3> (subheading - smaller)
    if (trimmed.match(/^<h3[^>]*>/i)) {
      let text = trimmed.replace(/<\/?h3[^>]*>/gi, "").trim();
      text = text.replace(/<[^>]+>/g, "").trim();
      if (text) {
        blocks.push({ type: "subheading", text });
        lastBlockType = "subheading";
      }
      continue;
    }

    // Markdown: # → H1 (skip, don't include in content blocks)
    if (trimmed.match(/^#\s+/)) {
      // H1 is the title, skip it - don't add to blocks
      continue;
    }

    // Markdown: ## → heading, ### → subheading (check ### first)
    if (trimmed.match(/^###\s+/)) {
      const text = trimmed.replace(/^###\s+/, "").trim();
      if (text) {
        blocks.push({ type: "subheading", text });
        lastBlockType = "subheading";
      }
      continue;
    }

    if (trimmed.match(/^##\s+/)) {
      const text = trimmed.replace(/^##\s+/, "").trim();
      if (text) {
        if (lastBlockType !== "heading" && lastBlockType !== "subheading") {
          blocks.push({ type: "heading", text });
          lastBlockType = "heading";
        }
      }
      continue;
    }

    // Image: <img src="..." alt="..." /> or ![alt](src)
    const imgMatch = trimmed.match(/<img[^>]+src="([^"]+)"[^>]*alt="([^"]*)"[^>]*\/?>/i);
    if (imgMatch) {
      blocks.push({ type: "image", src: imgMatch[1], alt: imgMatch[2] });
      continue;
    }

    const mdImgMatch = trimmed.match(/!\[([^\]]*)\]\(([^)]+)\)/);
    if (mdImgMatch) {
      blocks.push({ type: "image", src: mdImgMatch[2], alt: mdImgMatch[1] });
      continue;
    }

    // Skip meta tags sections
    if (trimmed.match(/Meta\s+Title|Meta\s+Description|Topics?/i)) {
      continue;
    }
    
    // Paragraph: strip <p> tags and other inline HTML, keep the text
    let text = trimmed
      .replace(/<\/?p[^>]*>/gi, "")
      .replace(/<\/?strong>/gi, "")
      .replace(/<\/?em>/gi, "")
      .replace(/<\/?ul>/gi, "")
      .replace(/<\/?li>/gi, "")
      .replace(/<\/?ol>/gi, "")
      .replace(/<\/?div[^>]*>/gi, "")
      .replace(/<\/?span[^>]*>/gi, "")
      .replace(/<\/?br\s*\/?>/gi, " ")
      .replace(/&nbsp;/gi, " ")
      .trim();
    
    // Remove markdown headings that might have slipped through (including H1)
    text = text.replace(/^#+\s+[^\n]+/gm, "").trim();
    
    // Skip if text looks like an H1 pattern (e.g., "Startup accelerator: A Strategic Guide")
    if (text.match(/^[A-Z][^.!?]{0,60}:\s*A Strategic Guide$/i)) {
      continue;
    }
    
    // Remove UI elements and source article metadata
    text = text.replace(/^(Save Story|Share|Subscribe|Sign up|Photograph:|Photo-Illustration:)[^\n]*/gim, "").trim();
    text = text.replace(/Photo-Illustration:[^\n]*/gi, "").trim();
    text = text.replace(/Comment Loader[^\n]*/gi, "").trim();
    text = text.replace(/Save this story[^\n]*/gi, "").trim();
    text = text.replace(/Getty Images[^\n]*/gi, "").trim();
    text = text.replace(/WIRED Staff[^\n]*/gi, "").trim();
    
    // Decode HTML entities
    text = text
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");

    // Remove any remaining stray HTML tags (except <a> which we keep for links)
    // First extract <a> tags, then remove all other HTML, then restore <a> tags
    const linkMatches: Array<{ placeholder: string; original: string }> = [];
    let linkIndex = 0;
    text = text.replace(/<a[^>]*>[\s\S]*?<\/a>/gi, (match) => {
      const placeholder = `__LINK_${linkIndex}__`;
      linkMatches.push({ placeholder, original: match });
      linkIndex++;
      return placeholder;
    });
    
    // Remove all remaining HTML tags
    text = text.replace(/<[^>]+>/g, "");
    
    // Restore <a> tags
    linkMatches.forEach(({ placeholder, original }) => {
      text = text.replace(placeholder, original);
    });

    // Clean up extra whitespace
    text = text.replace(/\s+/g, " ").trim();

    // Keep <a> tags as-is (they contain internal/external links from SEO step)
    if (text) {
      blocks.push({ type: "paragraph", text });
      lastBlockType = "paragraph";
    }
  }

  return blocks;
}

/**
 * Generate a URL-safe slug from a title.
 */
export function generateSlug(title: string): string {
  return slugify(title, {
    lower: true,
    strict: true,
    trim: true,
  });
}

/**
 * Generate a clean 2-3 line excerpt from content blocks.
 * Simple, straightforward extraction from first paragraph(s).
 */
export function generateExcerpt(blocks: ContentBlock[], metaDescription?: string): string {
  // Extract paragraphs, prioritizing actual article content over generic definitions
  const paragraphs = blocks
    .filter((b) => b.type === "paragraph")
    .map((p) => {
      let text = p.text || "";
      // Remove HTML tags (keep text only)
      text = text.replace(/<[^>]+>/g, "");
      // Decode HTML entities
      text = text
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ");
      // Clean up whitespace
      text = text.replace(/\s+/g, " ").trim();
      return text;
    })
    .filter((t) => {
      // Filter out headings that slipped through (start with # or look like headings)
      if (t.length < 20) return false;
      if (t.match(/^#+\s+/)) return false; // Markdown headings
      if (t.match(/^[A-Z][^.!?]{0,50}:\s*A Strategic Guide/i)) return false; // H1 patterns
      if (t.match(/^[A-Z][^.!?]{0,50}:\s*[A-Z]/)) return false; // Title-like patterns
      
      const lower = t.toLowerCase();
      
      // Filter out promotional/CTA content
      if (lower.match(/\b(explore our|visit our|check out our|learn more about our|for more insights|discover how|contact us|get started|sign up|subscribe)\b/)) {
        return false; // Skip promotional content
      }
      if (lower.match(/\b(automation services|our services|our section|our page|our dedicated)\b/)) {
        return false; // Skip service mentions
      }
      if (lower.match(/\b(transform your|enhance your|improve your|optimize your)\s+(digital|business|workflow|process)\b/)) {
        return false; // Skip generic promotional phrases
      }
      
      // Filter out generic definitions (these shouldn't be in excerpts)
      if (lower.match(/^[^.]*\b(refers to|is the process|is a|is an|is defined as|means|involves creating|involves developing)\b/)) {
        return false; // Skip generic definitions
      }
      if (lower.match(/\b(refers to the process|is the process of creating|is a transformative approach|provides unprecedented capabilities)\b/)) {
        return false; // Skip more generic definition patterns
      }
      // Filter out sentences that are just definitions
      if (lower.match(/^[^.]*\b(technology|software|application|system|platform)\b[^.]*\b(refers to|is the|is a|is an|means|involves)\b/)) {
        return false;
      }
      
      return true;
    });
  
  // Prioritize: skip first paragraph if it's a definition, get actual content
  // Look for paragraphs that contain actual news/information (not definitions or promotional content)
  const contentParagraphs = paragraphs
    .filter((p, index) => {
      const lower = p.toLowerCase();
      
      // Skip promotional/CTA content
      if (lower.match(/\b(explore our|visit our|check out our|learn more about our|for more insights|discover how|contact us|automation services|our services)\b/)) {
        return false;
      }
      
      // Skip if it's clearly a definition in the first few paragraphs
      if (index < 2 && lower.match(/\b(refers to|is the process|is defined as|means|involves)\b/)) {
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      // Prioritize paragraphs with actual news/information
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      
      const aScore = 
        (aLower.match(/\b(reached|announced|reported|said|according|recently|latest|new|launched|introduced|reveals|shows|indicates|suggests|highlights)\b/)?.length || 0) +
        (aLower.match(/\b(2024|2025|2026|\d{4})\b/)?.length || 0) * 2 + // Years are strong indicators
        (aLower.match(/[A-Z][a-z]+ [A-Z][a-z]+/)?.length || 0) + // Proper nouns
        (aLower.match(/\b(hollywood|company|companies|startup|startups|industry|market|users|people)\b/)?.length || 0);
      
      const bScore = 
        (bLower.match(/\b(reached|announced|reported|said|according|recently|latest|new|launched|introduced|reveals|shows|indicates|suggests|highlights)\b/)?.length || 0) +
        (bLower.match(/\b(2024|2025|2026|\d{4})\b/)?.length || 0) * 2 +
        (bLower.match(/[A-Z][a-z]+ [A-Z][a-z]+/)?.length || 0) +
        (bLower.match(/\b(hollywood|company|companies|startup|startups|industry|market|users|people)\b/)?.length || 0);
      
      return bScore - aScore; // Higher score first
    });
  
  // Take first 2-3 paragraphs that are actual content (not definitions or promotional)
  const selectedParagraphs = contentParagraphs.slice(0, 3);
    
  if (selectedParagraphs.length === 0) {
    // Fallback to meta description if no good paragraphs found
    if (metaDescription) {
      return metaDescription.slice(0, 250).trim();
    }
    // Last resort: use any paragraph (even if it's a definition)
    if (paragraphs.length > 0) {
      return paragraphs[0].slice(0, 250).trim();
    }
    return "";
  }

  // Join paragraphs
  let excerpt = selectedParagraphs.join(" ").trim();

  // Filter out generic filler text and definitions that shouldn't be in excerpts
  const genericPatterns = [
    /This aspect of technology requires careful consideration[^.]*/gi,
    /This development reflects broader trends[^.]*/gi,
    /Organizations evaluating these solutions should assess[^.]*/gi,
    /Understanding these factors helps ensure successful adoption[^.]*/gi,
    /This aspect of .* requires careful consideration[^.]*/gi,
    /.*\b(refers to the process|is the process of creating|is a transformative approach|provides unprecedented capabilities)\b[^.]*/gi,
    /.*\b(refers to|is the process|is defined as|means|involves creating|involves developing)\b[^.]*/gi,
  ];
  
  genericPatterns.forEach(pattern => {
    excerpt = excerpt.replace(pattern, '');
  });
  
  // If excerpt is too short after filtering, try meta description (it's usually more specific)
  if (excerpt.length < 50 && metaDescription && metaDescription.length > 50) {
    // Meta description is often a better summary than generic definitions
    excerpt = metaDescription.slice(0, 250).trim();
  }
  
  // Clean up any double spaces or weird punctuation left behind
  excerpt = excerpt.replace(/\s{2,}/g, ' ').trim();
  excerpt = excerpt.replace(/^[.,;:\s]+/, ''); // Remove leading punctuation

  // Limit to ~200-250 characters (2-3 lines)
  if (excerpt.length > 250) {
    const truncated = excerpt.slice(0, 250);
    const lastPeriod = truncated.lastIndexOf(".");
    const lastSpace = truncated.lastIndexOf(" ");
    
    if (lastPeriod > 100) {
      excerpt = excerpt.slice(0, lastPeriod + 1);
    } else if (lastSpace > 100) {
      excerpt = excerpt.slice(0, lastSpace) + "...";
    } else {
      excerpt = truncated + "...";
    }
  }

  return excerpt;
}
