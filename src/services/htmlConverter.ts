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

Format content in paragraph-by-paragraph structure. Use <p> for all paragraphs.
Use <h2> for major sections and <h3> for subheadings or numbered breakdowns.

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

  const htmlContent = response.choices[0]?.message?.content;
  if (!htmlContent) {
    throw new Error("OpenAI returned empty HTML content");
  }

  console.log("[OpenAI] HTML conversion complete.");
  return htmlContent.trim();
}
