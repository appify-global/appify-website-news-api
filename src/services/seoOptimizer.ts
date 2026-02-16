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
  primaryKeyword?: string;
}

/**
 * Optimize blog content for SEO using OpenAI GPT-4o-mini.
 */
export async function optimizeForSEO(blogContent: string): Promise<SEOResult> {
  console.log("[OpenAI] Optimizing content for SEO...");

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.8,
    max_tokens: 4000, // For 1,200-1,600 word articles
    messages: [
      {
        role: "system",
        content: `Optimize this blog post for long-term SEO authority. Focus on quality over quantity. Target stable search intent and build topical authority.

Instruction 1: Identify and optimize for ONE clear primary keyword plus 3-5 relevant long-tail variations. Choose keywords that:
- Align with our core topics (AI software, Digital transformation, App development, Workforce automation, Emerging technology strategy)
- Target stable, long-term search intent
- Have realistic ranking potential
- Match the article's actual content

Primary keyword examples:
- AI app development
- Digital transformation strategy
- Mobile app development
- Workforce automation solutions
- Technology adoption strategy

Long-tail variations (3-5 only):
- How to implement [primary keyword]
- Best practices for [primary keyword]
- [Primary keyword] for businesses
- [Primary keyword] benefits
- [Primary keyword] implementation guide

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

Instruction 2: Use the **primary keyword** naturally throughout (approximately 1-2% density, or 12-32 times in a 1,200-1,600 word article). It should appear:
- In the blog title (H1)
- Within the first 100 words
- In 2-3 subheadings (H2 or H3) - only where natural
- Throughout body paragraphs
- In the conclusion

Instruction 3: Distribute long-tail keywords naturally (2-3 times each maximum). Avoid keyword stuffing. Quality and natural integration over quantity.

Instruction 4: Maintain clear structure with H2s and H3s. Headings should be descriptive and natural. Only include keywords in headings when they fit naturally - don't force them.

Instruction 5: Maintain an authoritative, professional tone. Write for founders, CTOs, and product managers. Establish authority through:
- Strategic insights and analysis
- Practical, actionable guidance
- Industry expertise (without generic filler)
- Clear, confident writing
- Thought leadership perspective, not commentary

Instruction 6: Content Requirements:
- Keep paragraphs concise (3-5 lines)
- Avoid generic filler sections
- Avoid repeated phrasing
- Include practical insights and strategic depth
- Use bullet points or lists only when they add value
- NO emojis
- NO mention of RSS sources or original articles
- NO generic praise language ("revolutionary", "game-changing", etc.)
- NO promotional tone
- Ensure article has a definition section
- Ensure article has a practical implementation section
- Do NOT center content around specific companies - use them as examples only
- Focus on evergreen themes, not company-specific news

Instruction 7: At the end of the blog, generate:
– A meta title (maximum 60 characters) including the primary keyword at the beginning
– A meta description (maximum 160 characters) summarising the blog with a clear value proposition

Instruction 8: Include 4-6 strategic hyperlinks in the blog (quality over quantity):
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
TOPICS: [one or more topics from: AI, Automation, Web, Startups, Defi, Web3, Work, Design, Culture - separate multiple topics with commas, e.g. "AI, Startups" if the article covers both]`,
      },
      {
        role: "user",
        content: `Optimize this blog for long-term SEO authority. 

CRITICAL: Ensure the article:
- Focuses on the evergreen theme, NOT specific companies
- Uses companies only as supporting examples
- Has ONE clear primary keyword
- Includes a definition section
- Includes a practical implementation section
- Avoids generic praise language
- Avoids promotional tone
- Feels like industry thought leadership, not commentary

Focus on ONE primary keyword plus 3-5 long-tail variations. Remove any generic filler, repeated phrasing, time-sensitive references, or company-centric focus. Target stable search intent within: App development, AI integration, Digital transformation, Community-driven platforms:\n${blogContent}`,
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

  // Validate and filter topics - only allow our approved topics
  const allowedTopics = ["AI", "Automation", "Web", "Startups", "Defi", "Web3", "Work", "Design", "Culture"];
  let rawTopics = topicsMatch?.[1]?.trim() || "AI";
  
  // Parse comma-separated topics and validate each one
  const topicList = rawTopics.split(',').map(t => t.trim()).filter(t => t.length > 0);
  const validTopics: string[] = [];
  
  for (const topic of topicList) {
    // Check exact match
    if (allowedTopics.includes(topic)) {
      if (!validTopics.includes(topic)) {
        validTopics.push(topic);
      }
    } else {
      // Check case-insensitive match
      const matched = allowedTopics.find(t => t.toLowerCase() === topic.toLowerCase());
      if (matched && !validTopics.includes(matched)) {
        validTopics.push(matched);
      }
    }
  }
  
  // If no valid topics found, default to AI (but log a warning)
  const finalTopics = validTopics.length > 0 ? validTopics.join(", ") : "AI";
  
  if (validTopics.length === 0 || validTopics.length !== topicList.length) {
    console.warn(`[OpenAI] Invalid topics detected: "${rawTopics}". Filtered to: "${finalTopics}"`);
  }

  console.log("[OpenAI] SEO optimization complete.");

  return {
    optimizedContent,
    metaTitle: metaTitleMatch?.[1]?.trim().slice(0, 60) || "",
    metaDescription: metaDescMatch?.[1]?.trim().slice(0, 160) || "",
    topics: finalTopics,
  };
}
