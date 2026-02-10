import OpenAI from "openai";

let openai: OpenAI;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

interface SEOResult {
  optimizedContent: string;
  metaTitle: string;
  metaDescription: string;
  topics: string;
}

/**
 * Optimize blog content for SEO using OpenAI GPT-4o.
 */
export async function optimizeForSEO(blogContent: string): Promise<SEOResult> {
  console.log("[OpenAI] Optimizing content for SEO...");

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    temperature: 1,
    max_tokens: 2500,
    messages: [
      {
        role: "system",
        content: `Instruction 1: Make this blog post SEO-friendly by selecting and including at least 5 target keywords that are relevant to app development, AI software, and digital transformation. Choose keywords with realistic ranking potential based on search intent and relevance to the Australian tech market.

Instruction 2: Use the **primary keyword** with a density of approximately 1–3% throughout the blog content. It should appear naturally in headings, body text, and summary paragraphs.

Instruction 3: Ensure the **top keyword** is included:
– In the blog title (H1)
– Within the first 150 words of the article
– In at least 3 subheadings (H2 or H3)

Instruction 4: Maintain a clear structure using H2s and H3s. Make sure at least 3 subheadings contain a keyword or a close variation.

Instruction 5: Use a tone that is informative and confident, reflecting the voice of a modern, Australian-based app development agency that specialises in AI-driven solutions. Write as though addressing founders, CTOs, and product managers looking to build or improve software products.

Instruction 6: Keep paragraphs concise (3–5 lines), include bullet points or short lists where helpful, and use real-world use cases or scenarios to add practical value.

Instruction 7: At the end of the blog, generate:
– A meta title (maximum 60 characters) including the primary keyword
– A meta description (maximum 160 characters) summarising the blog with a clear call to action

Instruction 8: Include between 3–5 hyperlinks in the blog:
– Use **only the following internal links** if relevant to the topic:
  • /automation
  • /automation/seo
  • /automation/phone
  • /projects
  • /studio

– Use external links **only if they are recent, highly credible, and relevant** (e.g. OpenAI, Gartner, McKinsey, Statista, TechCrunch)

Use HTML syntax for links (e.g. <a href="/services/custom-software">custom software development</a>).

Anchor text must be **natural, readable, and contextual**. Do not use "click here" or placeholder-style phrases.

All links should appear inside <p> blocks, not headings or list items.

If no relevant internal link fits the context, do not force it.

Instruction 9: At the very end, output the following on separate lines:
META_TITLE: [your meta title here]
META_DESCRIPTION: [your meta description here]
TOPICS: [one of: AI, Automation, Web, Startups, Defi, Web3, Work, Design, Culture]`,
      },
      {
        role: "user",
        content: `Optimise this blog for SEO:\n${blogContent}`,
      },
    ],
  });

  const result = response.choices[0]?.message?.content || "";

  // Parse meta title, description, and topics from the end of the response
  const metaTitleMatch = result.match(/META_TITLE:\s*(.+)/);
  const metaDescMatch = result.match(/META_DESCRIPTION:\s*(.+)/);
  const topicsMatch = result.match(/TOPICS:\s*(.+)/);

  // Remove the meta lines from the content
  const optimizedContent = result
    .replace(/META_TITLE:\s*.+/, "")
    .replace(/META_DESCRIPTION:\s*.+/, "")
    .replace(/TOPICS:\s*.+/, "")
    .trim();

  console.log("[OpenAI] SEO optimization complete.");

  return {
    optimizedContent,
    metaTitle: metaTitleMatch?.[1]?.trim().slice(0, 60) || "",
    metaDescription: metaDescMatch?.[1]?.trim().slice(0, 160) || "",
    topics: topicsMatch?.[1]?.trim() || "AI",
  };
}
