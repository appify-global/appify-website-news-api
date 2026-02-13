import { RSSItem } from "./rss";
import OpenAI from "openai";

export type TopicType = 
  | "ai_agent"
  | "ai_app_development"
  | "startup_accelerator"
  | "automation_system"
  | "web3_infrastructure"
  | "ux_ui_design"
  | "enterprise_digital_transformation"
  | "workforce_automation"
  | "ai_software"
  | "general";

// Frontend category mapping
export type FrontendCategory = "AI" | "Web" | "Startups" | "Web3" | "Work" | "Design" | "Culture";

export interface TopicBlueprint {
  topic: TopicType;
  h1: string;
  sections: string[];
  description: string;
}

// Regex patterns for topic detection (primary method)
const TOPIC_PATTERNS: Array<{ topic: TopicType; patterns: RegExp[] }> = [
  {
    topic: "ai_agent",
    patterns: [
      /\bai\s+agent\b/i,
      /\bautonomous\s+agent\b/i,
      /\bagentic\s+ai\b/i,
      /\bai\s+agents\b/i,
      /\bdeploy\s+agents\b/i,
      /\bagent\s+deployment\b/i,
      /\bagent\s+framework\b/i,
      /\bmulti-agent\b/i,
    ],
  },
  {
    topic: "startup_accelerator",
    patterns: [
      /\bstartup\s+accelerator\b/i,
      /\baccelerator\s+program\b/i,
      /\bincubator\b/i,
      /\by\s+combinator\b/i,
      /\bseed\s+funding\b/i,
      /\bearly-stage\s+funding\b/i,
      /\bventure\s+capital\b/i,
      /\bstartup\s+ecosystem\b/i,
    ],
  },
  {
    topic: "web3_infrastructure",
    patterns: [
      /\bweb3\b/i,
      /\bblockchain\b/i,
      /\bcrypto(?:currency)?\b/i,
      /\bdefi\b/i,
      /\bnft\b/i,
      /\btoken(?:ization)?\b/i,
      /\bdecentralized\b/i,
      /\bsmart\s+contract\b/i,
      /\bdapp\b/i,
      /\bdao\b/i,
    ],
  },
  {
    topic: "automation_system",
    patterns: [
      /\bworkflow\s+automation\b/i,
      /\bprocess\s+automation\b/i,
      /\brobotic\s+process\s+automation\b/i,
      /\brpa\b/i,
      /\bautomation\s+platform\b/i,
      /\bautomate\s+workflows\b/i,
      /\bbusiness\s+process\s+automation\b/i,
      /\bipa\b/i, // Intelligent Process Automation
    ],
  },
  {
    topic: "workforce_automation",
    patterns: [
      /\bworkforce\s+automation\b/i,
      /\bworkplace\s+automation\b/i,
      /\bemployee\s+automation\b/i,
      /\bstaff\s+automation\b/i,
      /\bhr\s+automation\b/i,
      /\bhuman\s+resources\s+automation\b/i,
    ],
  },
  {
    topic: "ai_app_development",
    patterns: [
      /\bai\s+app\b/i,
      /\bai-powered\s+app\b/i,
      /\bai\s+mobile\s+app\b/i,
      /\bai\s+application\s+development\b/i,
      /\bbuild\s+ai\s+app\b/i,
      /\bdevelop\s+ai\s+app\b/i,
      /\bai\s+software\s+development\b/i,
    ],
  },
  {
    topic: "ux_ui_design",
    patterns: [
      /\bux\s+design\b/i,
      /\bui\s+design\b/i,
      /\buser\s+experience\b/i,
      /\buser\s+interface\b/i,
      /\bdesign\s+system\b/i,
      /\bdesign\s+thinking\b/i,
      /\binteraction\s+design\b/i,
      /\bvisual\s+design\b/i,
    ],
  },
  {
    topic: "enterprise_digital_transformation",
    patterns: [
      /\bdigital\s+transformation\b/i,
      /\bdigital\s+strategy\b/i,
      /\benterprise\s+transformation\b/i,
      /\bdigital\s+initiative\b/i,
      /\bdigital\s+modernization\b/i,
      /\benterprise\s+digital\b/i,
    ],
  },
  {
    topic: "ai_software",
    patterns: [
      /\bai\s+software\b/i,
      /\bartificial\s+intelligence\s+software\b/i,
      /\bai\s+platform\b/i,
      /\bai\s+solution\b/i,
      /\bml\s+platform\b/i,
      /\bmachine\s+learning\s+software\b/i,
      /\bgenerative\s+ai\b/i,
      /\bllm\b/i, // Large Language Model
      /\bneural\s+network\b/i,
    ],
  },
];

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[TopicDetector] OPENAI_API_KEY not set, LLM fallback disabled");
    return null;
  }
  if (!openai) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

/**
 * Detect topic using LLM with low temperature (fallback method)
 */
async function detectTopicWithLLM(item: RSSItem): Promise<TopicType> {
  const client = getOpenAI();
  if (!client) {
    return "general";
  }

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini", // Using mini for cost efficiency
      temperature: 0.2, // Low temperature for consistent, deterministic classification
      max_tokens: 50,
      messages: [
        {
          role: "system",
          content: `You are a topic classifier. Classify articles into one of these topics: ai_agent, ai_app_development, startup_accelerator, automation_system, web3_infrastructure, ux_ui_design, enterprise_digital_transformation, workforce_automation, ai_software, or general. Respond with ONLY the topic name, nothing else.`,
        },
        {
          role: "user",
          content: `Title: ${item.title}\n\nSnippet: ${item.contentSnippet || ""}\n\nClassify this article into one of the topics.`,
        },
      ],
    });

    const topic = response.choices[0]?.message?.content?.trim().toLowerCase() as TopicType;
    
    // Validate the topic
    const validTopics: TopicType[] = [
      "ai_agent",
      "ai_app_development",
      "startup_accelerator",
      "automation_system",
      "web3_infrastructure",
      "ux_ui_design",
      "enterprise_digital_transformation",
      "workforce_automation",
      "ai_software",
      "general",
    ];
    
    if (validTopics.includes(topic)) {
      console.log(`[TopicDetector] LLM classified as: ${topic}`);
      return topic;
    }
    
    console.warn(`[TopicDetector] LLM returned invalid topic: ${topic}, defaulting to general`);
    return "general";
  } catch (error) {
    console.error(`[TopicDetector] LLM classification failed:`, error);
    return "general";
  }
}

/**
 * Detect the dominant topic from RSS item using regex patterns (primary) with LLM fallback
 */
export async function detectTopic(item: RSSItem): Promise<TopicType> {
  const text = (item.title + " " + (item.contentSnippet || "") + " " + (item.content || "")).toLowerCase();
  
  // Primary: Try regex patterns first
  for (const { topic, patterns } of TOPIC_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        console.log(`[TopicDetector] Regex matched: ${topic}`);
        return topic;
      }
    }
  }
  
  // Fallback: Use LLM if no regex match
  console.log(`[TopicDetector] No regex match found, using LLM fallback`);
  return await detectTopicWithLLM(item);
}

/**
 * Map TopicType to frontend category
 */
export function mapTopicToFrontendCategory(topic: TopicType): FrontendCategory {
  const mapping: Record<TopicType, FrontendCategory> = {
    ai_agent: "AI",
    ai_app_development: "AI",
    ai_software: "AI",
    automation_system: "Web", // Map automation to Web
    workforce_automation: "Work", // Map workforce automation to Work
    startup_accelerator: "Startups",
    web3_infrastructure: "Web3", // Defi is included in Web3
    ux_ui_design: "Design",
    enterprise_digital_transformation: "Web",
    general: "AI", // Default to AI
  };
  
  return mapping[topic] || "AI";
}

/**
 * Get topic-specific blueprint with SEO-friendly headings
 */
export function getTopicBlueprint(topic: TopicType): TopicBlueprint {
  const blueprints: Record<TopicType, TopicBlueprint> = {
    ai_agent: {
      topic: "ai_agent",
      h1: "What Is an AI Agent? Definition, Benefits, Implementation, and Enterprise Applications",
      sections: [
        "What Is an AI Agent?",
        "How AI Agents Work: Perception, Decision Logic, and Execution Architecture",
        "Implementation Strategy for AI Agents: Step-by-Step Guidance and Real Constraints",
        "Risks and Trade-Offs for AI Agents: Mitigation Strategies",
        "Decision Framework: How to Evaluate AI Agent Platforms and Deployment Approaches"
      ],
      description: "AI agent technology, architecture layers, enterprise deployment, system integration, governance, security, and trade-offs"
    },
    ai_app_development: {
      topic: "ai_app_development",
      h1: "AI App Development: Definition, Benefits, Implementation, and Best Practices",
      sections: [
        "What Is AI App Development?",
        "How AI App Development Works: APIs, Data Flow, and System Architecture",
        "Implementation Strategy for AI Apps: Step-by-Step Guidance and Real Constraints",
        "Risks and Trade-Offs in AI App Development: Mitigation Strategies",
        "Decision Framework: How to Evaluate AI App Development Tools and Approaches"
      ],
      description: "AI app development, architecture selection, system design, inference layers, model lifecycle, governance, and trade-offs"
    },
    startup_accelerator: {
      topic: "startup_accelerator",
      h1: "What Is a Startup Accelerator? Definition, Benefits, Implementation, and Program Structure",
      sections: [
        "What Is a Startup Accelerator?",
        "How Startup Accelerators Work: Funding Mechanics, Equity Structures, and Program Components",
        "Implementation Strategy for Startup Accelerators: Step-by-Step Guidance and Real Constraints",
        "Risks and Trade-Offs for Startup Founders: Mitigation Strategies",
        "Decision Framework: How to Evaluate Startup Accelerator Programs and Approaches"
      ],
      description: "Startup accelerators, funding mechanics, ecosystem incentives, and strategic implications"
    },
    automation_system: {
      topic: "automation_system",
      h1: "Workflow Automation: Definition, Benefits, Implementation, and Enterprise Guide",
      sections: [
        "What Is Workflow Automation?",
        "How Workflow Automation Works: Orchestration, Event-Driven Patterns, and System Components",
        "Implementation Strategy for Workflow Automation: Step-by-Step Guidance and Real Constraints",
        "Risks and Trade-Offs in Workflow Automation: Mitigation Strategies",
        "Decision Framework: How to Evaluate Workflow Automation Tools and Approaches"
      ],
      description: "Workflow automation, orchestration architecture, integration patterns, cost-benefit analysis, governance, and risk management"
    },
    web3_infrastructure: {
      topic: "web3_infrastructure",
      h1: "Web3 Infrastructure: Definition, Benefits, Implementation, and Enterprise Applications",
      sections: [
        "What Is the Web3 Model?",
        "How Web3 Infrastructure Works: Blockchain Architecture, Smart Contracts, and System Components",
        "Implementation Strategy for Web3 Infrastructure: Step-by-Step Guidance and Real Constraints",
        "Risks and Trade-Offs in Web3 Infrastructure: Mitigation Strategies",
        "Decision Framework: How to Evaluate Web3 Infrastructure Tools and Approaches"
      ],
      description: "Web3 infrastructure, technology stack, token economics, regulatory concerns, and enterprise adoption"
    },
    ux_ui_design: {
      topic: "ux_ui_design",
      h1: "UX/UI Design: Definition, Benefits, Implementation, and Best Practices",
      sections: [
        "What Is UX/UI Design?",
        "How UX/UI Design Works: Design Systems, Component Libraries, and User Research Methods",
        "Implementation Strategy for UX/UI Design Systems: Step-by-Step Guidance and Real Constraints",
        "Risks and Trade-Offs in UX/UI Design: Mitigation Strategies",
        "Decision Framework: How to Evaluate UX/UI Design Tools and Approaches"
      ],
      description: "UX/UI design, design systems, user research, implementation strategies, and design ROI"
    },
    enterprise_digital_transformation: {
      topic: "enterprise_digital_transformation",
      h1: "Enterprise Digital Transformation: Definition, Benefits, Implementation, and Strategic Guide",
      sections: [
        "What Is Enterprise Digital Transformation?",
        "How Enterprise Digital Transformation Works: Technology Stack, Integration Patterns, and System Architecture",
        "Implementation Strategy for Digital Transformation: Step-by-Step Guidance and Real Constraints",
        "Risks and Trade-Offs in Digital Transformation: Mitigation Strategies",
        "Decision Framework: How to Evaluate Digital Transformation Tools and Approaches"
      ],
      description: "Enterprise digital transformation, strategic planning, technology stack, change management, and ROI"
    },
    workforce_automation: {
      topic: "workforce_automation",
      h1: "Workforce Automation: Definition, Benefits, Implementation, and Enterprise Guide",
      sections: [
        "What Is Workforce Automation?",
        "How Workforce Automation Works: Automation Technologies, Orchestration, and System Components",
        "Implementation Strategy for Workforce Automation: Step-by-Step Guidance and Real Constraints",
        "Risks and Trade-Offs in Workforce Automation: Mitigation Strategies",
        "Decision Framework: How to Evaluate Workforce Automation Tools and Approaches"
      ],
      description: "Workforce automation, technologies, implementation strategies, cost-benefit analysis, and trade-offs"
    },
    ai_software: {
      topic: "ai_software",
      h1: "AI Software: Definition, Benefits, Implementation, and Enterprise Applications",
      sections: [
        "What Is AI Software?",
        "How AI Software Works: Architecture, APIs, Data Flow, and System Components",
        "Implementation Strategy for AI Software: Step-by-Step Guidance and Real Constraints",
        "Risks and Trade-Offs in AI Software: Mitigation Strategies",
        "Decision Framework: How to Evaluate AI Software Tools and Approaches"
      ],
      description: "AI software, architecture, implementation strategies, integration challenges, and enterprise use cases"
    },
    general: {
      topic: "general",
      h1: "Technology Innovation: Definition, Benefits, Implementation, and Strategic Applications",
      sections: [
        "What Is This Technology?",
        "How This Technology Works: Architecture, System Components, and Data Flow",
        "Implementation Strategy: Step-by-Step Guidance and Real Constraints",
        "Risks and Trade-Offs: Mitigation Strategies",
        "Decision Framework: How to Evaluate Tools and Approaches"
      ],
      description: "Technology innovation, architecture, implementation, benefits, and industry applications"
    }
  };
  
  return blueprints[topic];
}
