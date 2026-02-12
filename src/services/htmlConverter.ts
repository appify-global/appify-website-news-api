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
    model: "gpt-4o",
    temperature: 1,
    max_tokens: 10000,
    messages: [
      {
        role: "system",
        content: `Generate clean HTML output using only the following tags: <h2>, <h3>, <p>, <ul>, <li>, <a>.

DO NOT use any other HTML tags (e.g. <h1>, <style>, <div>, <span>) or any inline styles. DO NOT include Markdown, explanations, or any text outside the HTML.
DO NOT add font-size, style attributes, or any sizing to headings - the frontend will handle all styling.

Format content in paragraph-by-paragraph structure. Use <p> for all paragraphs.
Use <h2> for major section headings (main topics).
Use <h3> for subheadings (subtopics within a section).

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

  console.log("[OpenAI] HTML conversion complete.");
  return htmlContent.trim();
}
