import OpenAI from "openai";
import { RSSItem } from "./rss";

let openai: OpenAI;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Generate a blog post from an RSS article using OpenAI GPT-4o.
 * Mirrors the Make.com GPT step with the same prompts.
 */
export async function generateBlogContent(item: RSSItem): Promise<string> {
  console.log(`[OpenAI] Generating blog for: ${item.title}`);

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    temperature: 1,
    max_tokens: 8000, // Increased for longer content
    messages: [
      {
        role: "system",
        content: `Write a comprehensive, in-depth blog for Appify Australia around the information in the article while reflecting on it as a thought leader: ${item.link}`,
      },
      {
        role: "assistant",
        content: `Rule 1: Make sure to provide Headings for ALL relevant sections of the blog.

Rule 2: The blog length MUST be between 3000 - 4000 words to exceed competitor depth and provide comprehensive value.

Rule 3: Structure must include these comprehensive sections to establish authority:

**Introduction** (300-500 words)
- Engaging hook that addresses search intent
- Define key terms and concepts
- Preview what the reader will learn
- Set context for why this topic matters

**What is [Topic]?** (400-600 words)
- Comprehensive definition and explanation
- Historical context and evolution
- Current state of the industry/technology
- Why it matters in today's landscape

**Why [Topic] Matters** (400-600 words)
- Industry statistics and data
- Real-world impact and implications
- Business and economic implications
- Future trends and predictions

**How [Topic] Works** (500-800 words)
- Step-by-step explanation or breakdown
- Technical details (accessible to non-technical readers)
- Examples and use cases
- Common misconceptions clarified

**Best Practices and Implementation** (400-600 words)
- Actionable advice and recommendations
- Do's and don'ts
- Expert recommendations
- Practical implementation tips

**Case Studies and Real-World Examples** (400-600 words)
- Real companies or projects using this
- Success stories with quantifiable results
- Lessons learned
- Industry applications

**Common Challenges and Solutions** (300-500 words)
- Problems people commonly face
- How to overcome these challenges
- Tools and resources available
- Expert insights

**Future of [Topic]** (300-400 words)
- Emerging trends and developments
- Predictions for the next 2-5 years
- How to stay ahead of the curve
- Opportunities for businesses

**Conclusion** (300-400 words)
- Key takeaways and summary
- Actionable next steps for readers
- Call to action (natural, not salesy)
- Internal links to related content

Important: Focus on why this news matters, not just what happened. Avoid marketing speak or SEO padding - look like human written content. Keep it clear, insightful, authoritative, and relevant to people who care about Mobile apps, Technology, and innovative software. Provide depth that exceeds what competitors offer.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned empty content");
  }

  console.log(`[OpenAI] Generated ${content.split(" ").length} words.`);
  return content;
}
