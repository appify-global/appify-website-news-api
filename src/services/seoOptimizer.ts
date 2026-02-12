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
    max_tokens: 8000, // Increased for longer optimized content
    messages: [
      {
        role: "system",
        content: `Instruction 1: Make this blog post SEO-friendly by selecting and including 15-20 target keywords that are relevant to app development, AI software, and digital transformation. Include BOTH primary and long-tail keywords:

**Primary Keywords** (high volume, competitive):
- app development company
- AI app development
- mobile app developers
- custom software development
- app developers Australia

**Long-tail Keywords** (lower volume, easier to rank):
- how to build AI apps in Australia
- what is AI app development
- AI app development vs traditional app development
- best AI app developers Melbourne
- custom mobile app development services
- enterprise app development solutions
- AI-powered mobile applications
- app development for startups
- digital transformation through apps

**Question-based Keywords** (voice search):
- how does AI app development work
- what are the benefits of AI in app development
- when should you use AI in mobile apps

**Location-based Keywords**:
- AI app developers Sydney
- app development company Melbourne
- mobile app developers Australia

Choose keywords with realistic ranking potential based on search intent and relevance to the Australian tech market.

Instruction 2: Use the **primary keyword** with a density of approximately 1–3% throughout the blog content (8-12 times in a 3000-4000 word article). It should appear naturally in:
- The blog title (H1)
- Within the first 100 words
- In at least 4-5 subheadings (H2 or H3)
- Throughout body paragraphs
- In the conclusion

Instruction 3: Distribute long-tail keywords naturally:
- Each long-tail variation: 3-5 times throughout the article
- Semantic keywords: 2-3 times each
- LSI (Latent Semantic Indexing) keywords: naturally throughout
- Location keywords: 2-3 times if relevant

Instruction 4: Maintain a clear structure using H2s and H3s. Make sure at least 5-6 subheadings contain a keyword or close variation. Headings should be descriptive and keyword-rich but natural.

Instruction 5: Use a tone that is informative, authoritative, and confident, reflecting the voice of a modern, Australian-based app development agency that specialises in AI-driven solutions. Write as though addressing founders, CTOs, and product managers looking to build or improve software products. Establish E-E-A-T (Expertise, Experience, Authoritativeness, Trust) by:
- Citing authoritative sources (Gartner, McKinsey, industry reports)
- Including expert insights and data
- Showing first-hand experience ("At Appify, we've seen...")
- Providing actionable, practical advice

Instruction 6: Keep paragraphs concise (3–5 lines), include bullet points or short lists where helpful, and use real-world use cases, statistics, and scenarios to add practical value and authority.

Instruction 7: At the end of the blog, generate:
– A meta title (maximum 60 characters) including the primary keyword at the beginning
– A meta description (maximum 160 characters) summarising the blog with a clear value proposition

Instruction 8: Include 8-12 strategic hyperlinks in the blog:
– Use **only the following internal links** if relevant to the topic:
  • /automation
  • /automation/seo
  • /automation/phone
  • /projects
  • /studio

– Use external links **only if they are recent, highly credible, and relevant** (e.g. OpenAI, Gartner, McKinsey, Statista, TechCrunch, official documentation)

Use HTML syntax for links (e.g. <a href="/automation">automation services</a>).

Anchor text must be **natural, readable, and contextual**. Use descriptive anchor text that includes keywords when appropriate (e.g. "AI app development services" not "click here").

All links should appear inside <p> blocks, not headings or list items.

Distribute links throughout the article naturally - don't cluster them all in one section.

If no relevant internal link fits the context, do not force it. Quality over quantity.

Instruction 9: At the very end, output the following on separate lines:
META_TITLE: [your meta title here]
META_DESCRIPTION: [your meta description here]
TOPICS: [one of: AI, Automation, Web, Startups, Defi, Web3, Work, Design, Culture]`,
      },
      {
        role: "user",
        content: `Optimise this blog for SEO to dominate search results. Target 15-20 keywords (primary and long-tail), include 8-12 strategic links, and ensure comprehensive depth:\n${blogContent}`,
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
