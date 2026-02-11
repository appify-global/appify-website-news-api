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
    
    // Remove markdown headings that might have slipped through
    text = text.replace(/^##+\s+[^\n]+/gm, "").trim();
    
    // Remove UI elements
    text = text.replace(/^(Save Story|Share|Subscribe|Sign up|Photograph:)[^\n]*/gim, "").trim();
    
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
 * Generate a 2-3 line excerpt from content blocks.
 * Removes hashtags and creates a clean description.
 */
export function generateExcerpt(blocks: ContentBlock[], metaDescription?: string): string {
  // If we have a meta description, use it as base (it's usually well-formatted)
  if (metaDescription) {
    // Remove hashtags and clean up
    let clean = metaDescription
      .replace(/#\w+/g, "") // Remove hashtags
      // Decode HTML entities
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      // Remove generic boilerplate
      .replace(/is a key focus in today's technology landscape\.?/gi, "")
      .replace(/Learn about the latest developments in app development and technology\.?/gi, "")
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();
    
    // Ensure it's 2-3 lines (roughly 150-300 characters)
    if (clean.length > 300) {
      // Find a good breaking point (sentence end)
      const truncated = clean.slice(0, 300);
      const lastPeriod = truncated.lastIndexOf(".");
      const lastComma = truncated.lastIndexOf(",");
      const breakPoint = Math.max(lastPeriod, lastComma);
      
      if (breakPoint > 150) {
        clean = clean.slice(0, breakPoint + 1);
      } else {
        clean = clean.slice(0, 297) + "...";
      }
    }
    
    return clean;
  }

  // Fallback: Extract from first 2-3 paragraphs
  const paragraphs = blocks.filter((b) => b.type === "paragraph").slice(0, 3);
  if (paragraphs.length === 0) return "";

  let excerpt = paragraphs
    .map((p) => {
      let text = p.text || "";
      // Remove HTML tags
      text = text.replace(/<[^>]+>/g, "");
      // Decode HTML entities (fix &#039; and other entities)
      text = text
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ");
      // Remove hashtags
      text = text.replace(/#\w+/g, "");
      // Remove generic boilerplate text that might have been added
      text = text.replace(/is a key focus in today's technology landscape\.?/gi, "");
      text = text.replace(/Learn about the latest developments in app development and technology\.?/gi, "");
      // Clean up whitespace
      text = text.replace(/\s+/g, " ").trim();
      return text;
    })
    .filter((t) => t.length > 0 && !t.match(/^(App development|app development)/i)) // Filter out generic starts
    .join(" ");

  // Limit to ~250 characters for 2-3 lines
  if (excerpt.length > 250) {
    const truncated = excerpt.slice(0, 250);
    const lastPeriod = truncated.lastIndexOf(".");
    const lastSpace = truncated.lastIndexOf(" ");
    
    if (lastPeriod > 150) {
      excerpt = excerpt.slice(0, lastPeriod + 1);
    } else if (lastSpace > 150) {
      excerpt = excerpt.slice(0, lastSpace) + "...";
    } else {
      excerpt = truncated + "...";
    }
  }

  return excerpt;
}
