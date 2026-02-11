/**
 * Code-based HTML converter.
 * Converts markdown-style content to clean HTML without OpenAI.
 */

/**
 * Convert content to clean HTML format using code-based parsing.
 */
export async function convertToHTML(content: string): Promise<string> {
  console.log("[Code] Converting content to clean HTML...");

  // Split content into lines
  const lines = content.split("\n").map((line) => line.trim()).filter((line) => line);

  const htmlBlocks: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // H2 headings (## Heading)
    if (line.startsWith("## ") && !line.startsWith("### ")) {
      const heading = line.replace(/^##\s+/, "");
      htmlBlocks.push(`<p class="spacer"></p>`);
      htmlBlocks.push(`<h2>${escapeHtml(heading)}</h2>`);
      htmlBlocks.push(`<p class="spacer"></p>`);
      continue;
    }

    // H3 headings (### Heading)
    if (line.startsWith("### ")) {
      const heading = line.replace(/^###\s+/, "");
      htmlBlocks.push(`<p class="spacer"></p>`);
      htmlBlocks.push(`<h3>${escapeHtml(heading)}</h3>`);
      htmlBlocks.push(`<p class="spacer"></p>`);
      continue;
    }

    // Bullet points (- item or * item)
    if (line.match(/^[-*]\s+/)) {
      const listItem = line.replace(/^[-*]\s+/, "");
      htmlBlocks.push(`<ul><li>${escapeHtml(listItem)}</li></ul>`);
      continue;
    }

    // Regular paragraphs
    if (line.length > 0) {
      // Skip lines that are markdown headings (should have been converted already)
      if (line.match(/^##+\s+/)) {
        continue; // Skip markdown headings in paragraph processing
      }
      
      // Decode HTML entities that might be in the text
      let cleanLine = line
        .replace(/&#039;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&nbsp;/g, " ");
      
      // Check if line already contains HTML (from SEO optimization with links)
      if (cleanLine.includes("<a ")) {
        htmlBlocks.push(`<p>${cleanLine}</p>`);
      } else {
        htmlBlocks.push(`<p>${escapeHtml(cleanLine)}</p>`);
      }
    }
  }

  const htmlContent = htmlBlocks.join("\n");

  console.log("[Code] HTML conversion complete.");
  return htmlContent;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
