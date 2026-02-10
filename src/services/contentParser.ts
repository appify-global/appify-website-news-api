import slugify from "slugify";

interface ContentBlock {
  type: "paragraph" | "heading" | "image";
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

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Heading: <h2>...</h2> or <h3>...</h3> or ## ... or ### ...
    if (trimmed.match(/^<h[23][^>]*>/i)) {
      const text = trimmed.replace(/<\/?h[23][^>]*>/gi, "").trim();
      if (text) {
        blocks.push({ type: "heading", text });
      }
      continue;
    }

    if (trimmed.match(/^#{2,3}\s+/)) {
      const text = trimmed.replace(/^#{2,3}\s+/, "").trim();
      if (text) {
        blocks.push({ type: "heading", text });
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
      .trim();

    // Keep <a> tags as-is (they contain internal/external links from SEO step)
    if (text) {
      blocks.push({ type: "paragraph", text });
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
 * Extract the first ~200 characters as an excerpt.
 */
export function generateExcerpt(blocks: ContentBlock[]): string {
  const firstParagraph = blocks.find((b) => b.type === "paragraph");
  if (!firstParagraph?.text) return "";

  const plainText = firstParagraph.text.replace(/<[^>]+>/g, "");
  return plainText.length > 200
    ? plainText.slice(0, 197) + "..."
    : plainText;
}
