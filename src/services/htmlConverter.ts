import OpenAI from "openai";

let openai: OpenAI;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Convert SEO-optimized content to clean HTML format.
 * Mirrors the Make.com OpenAI HTML conversion step.
 */
export async function convertToHTML(seoContent: string): Promise<string> {
  console.log("[OpenAI] Converting content to clean HTML...");

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 1,
    max_tokens: 10000,
    messages: [
      {
        role: "system",
        content: `Generate clean HTML output using only the following tags: <h2>, <h3>, <p>, <a>.

ABSOLUTELY FORBIDDEN: DO NOT use <ul> or <li> tags under ANY circumstances. These tags are NOT allowed.
DO NOT use any other HTML tags (e.g. <h1>, <style>, <div>, <span>) or any inline styles. DO NOT include Markdown, explanations, or any text outside the HTML.
DO NOT add font-size, style attributes, or any sizing to headings - the frontend will handle all styling.

Format content in paragraph-by-paragraph structure. Use <p> for all paragraphs.
Use <h2> for major section headings (main topics).
Use <h3> for subheadings (subtopics within a section).

CRITICAL BULLET POINT CONVERSION RULE:
- If the input content contains ANY bullet points, lists, or items with titles like "Start Small:", "Focus on Data Quality:", etc., you MUST convert each one into a FULL PARAGRAPH
- Each bullet/list item must become a complete <p> paragraph with 3-4 sentences minimum
- Include the title/heading as part of the paragraph text, then expand it with explanation, context, examples, and detail
- Example: "Start Small: Begin with a pilot project..." becomes "<p>Starting small represents a critical best practice for AI app development, as organizations should begin with a pilot project to test assumptions and gather insights before scaling to full production deployments. This approach allows teams to validate technical feasibility, identify potential integration challenges, and assess resource requirements without committing to large-scale infrastructure investments. Pilot projects also provide valuable data for refining AI models and understanding real-world performance characteristics before broader implementation.</p>"
- NEVER output <ul> or <li> tags - ALWAYS convert to <p> paragraphs

To ensure correct visual spacing in Webflow:
- Insert a \`<p class="spacer"></p>\` **before and after every \`<h2>\` and \`<h3>\` heading**
- Also insert \`<p class="spacer"></p>\` between paragraph groups where a break is needed
- Do not use \`<p></p>\` or \`<br>\` for spacing

DO NOT include special characters like #, @, %, $, *, /, as they may break Webflow CMS formatting.

Only output valid HTML — no labels, commentary, or non-HTML content.`,
      },
      {
        role: "user",
        content: `Here is the blog content to convert:\n\n${seoContent}`,
      },
    ],
  });

  let htmlContent = response.choices[0]?.message?.content;
  if (!htmlContent) {
    throw new Error("OpenAI returned empty HTML content");
  }

  // Clean up any stray content from OpenAI
  // Remove markdown code blocks (```html, ```, ```markdown, etc.)
  htmlContent = htmlContent.replace(/```[a-z]*\s*/gi, "");
  htmlContent = htmlContent.replace(/```\s*/g, "");
  
  // Remove any AI explanations before/after HTML
  htmlContent = htmlContent.replace(/^(Here's|Here is|This is|The following|Below is|I'll|I will).*?:\s*/gim, "");
  
  // Find the first < and last > to extract only HTML content
  const firstTag = htmlContent.indexOf("<");
  const lastTag = htmlContent.lastIndexOf(">");
  
  if (firstTag !== -1 && lastTag !== -1 && lastTag > firstTag) {
    htmlContent = htmlContent.substring(firstTag, lastTag + 1);
  }
  
  // Remove any remaining non-HTML text at start/end
  htmlContent = htmlContent.replace(/^[^<]*/, ""); // Remove text before first <
  htmlContent = htmlContent.replace(/[^>]*$/, ""); // Remove text after last >
  
  // Remove any stray HTML comments
  htmlContent = htmlContent.replace(/<!--[\s\S]*?-->/g, "");
  
  // Remove any script/style tags that might have slipped through
  htmlContent = htmlContent.replace(/<script[\s\S]*?<\/script>/gi, "");
  htmlContent = htmlContent.replace(/<style[\s\S]*?<\/style>/gi, "");
  
  // Remove any markdown that might have slipped through
  htmlContent = htmlContent.replace(/##\s+/g, ""); // Remove markdown H2
  htmlContent = htmlContent.replace(/###\s+/g, ""); // Remove markdown H3
  htmlContent = htmlContent.replace(/\*\*([^*]+)\*\*/g, "$1"); // Remove bold markdown
  htmlContent = htmlContent.replace(/\*([^*]+)\*/g, "$1"); // Remove italic markdown
  htmlContent = htmlContent.replace(/`([^`]+)`/g, "$1"); // Remove inline code markdown
  
  // Remove inline styles from all tags (especially headings)
  htmlContent = htmlContent.replace(/\s+style="[^"]*"/gi, "");
  htmlContent = htmlContent.replace(/\s+style='[^']*'/gi, "");
  
  // Remove font-size, size, and other sizing attributes
  htmlContent = htmlContent.replace(/\s+font-size="[^"]*"/gi, "");
  htmlContent = htmlContent.replace(/\s+size="[^"]*"/gi, "");
  
  // Remove any stray HTML tags that aren't allowed (div, span, etc.)
  htmlContent = htmlContent.replace(/<div[^>]*>/gi, "");
  htmlContent = htmlContent.replace(/<\/div>/gi, "");
  htmlContent = htmlContent.replace(/<span[^>]*>/gi, "");
  htmlContent = htmlContent.replace(/<\/span>/gi, "");
  htmlContent = htmlContent.replace(/<h1[^>]*>.*?<\/h1>/gi, ""); // Remove H1 tags

  // Convert any bullet points/lists that slipped through into paragraphs
  // This is a fallback - the LLM should have already expanded them, but if not, convert them here
  htmlContent = htmlContent.replace(/<ul[^>]*>[\s\S]*?<\/ul>/gi, (match) => {
    // Extract all list items
    const listItems = match.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
    if (listItems.length === 0) return "";
    
    // Convert each list item to a paragraph
    const paragraphs = listItems.map(li => {
      const text = li.replace(/<li[^>]*>|<\/li>/gi, "").trim();
      if (!text) return "";
      // Remove any bold tags and convert to plain paragraph
      const cleanText = text.replace(/<strong[^>]*>|<\/strong>/gi, "").replace(/<b[^>]*>|<\/b>/gi, "");
      return `<p>${cleanText}</p>`;
    }).filter(p => p.length > 0);
    
    return paragraphs.join("\n");
  });
  
  // Remove any remaining <ul> or <li> tags (in case of malformed HTML)
  htmlContent = htmlContent.replace(/<ul[^>]*>/gi, "");
  htmlContent = htmlContent.replace(/<\/ul>/gi, "");
  htmlContent = htmlContent.replace(/<li[^>]*>/gi, "<p>");
  htmlContent = htmlContent.replace(/<\/li>/gi, "</p>");
  
  // Detect and expand bullet-like patterns in paragraphs
  // Pattern 1: <p><strong>Title:</strong> short description</p> (bullet-like structure)
  htmlContent = htmlContent.replace(/<p[^>]*>\s*<strong[^>]*>([^<]+):<\/strong>\s*([^<]+)<\/p>/gi, (match, title, content) => {
    const titleClean = title.trim();
    const contentClean = content.trim();
    const wordCount = contentClean.split(/\s+/).length;
    
    // If content is already substantial (60+ words), keep as is
    if (wordCount >= 60) {
      return match;
    }
    
    // Otherwise, expand into a full paragraph (this should have been done by LLM, but fallback)
    // Note: This is a minimal fix - the real solution is LLM generating full paragraphs from the start
    const expanded = `${titleClean} represents a critical best practice for AI app development. ${contentClean} This approach ensures proper implementation and helps organizations achieve better outcomes through careful planning, execution, and continuous refinement based on real-world feedback and performance metrics.`;
    return `<p>${expanded}</p>`;
  });
  
  // Pattern 2: Markdown-style **Title:** in paragraphs (before HTML conversion)
  htmlContent = htmlContent.replace(/<p[^>]*>\s*\*\*([^*]+):\*\*\s*([^<]+)<\/p>/gi, (match, title, content) => {
    const titleClean = title.trim();
    const contentClean = content.trim();
    const wordCount = contentClean.split(/\s+/).length;
    
    if (wordCount >= 60) {
      return match;
    }
    
    const expanded = `${titleClean} represents a critical best practice for AI app development. ${contentClean} This approach ensures proper implementation and helps organizations achieve better outcomes through careful planning, execution, and continuous refinement based on real-world feedback and performance metrics.`;
    return `<p>${expanded}</p>`;
  });

  console.log("[OpenAI] HTML conversion complete.");
  return htmlContent.trim();
}
