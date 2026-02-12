import { RSSItem } from "./rss";

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

export interface TopicBlueprint {
  topic: TopicType;
  h1: string;
  sections: string[];
  description: string;
}

/**
 * Detect the dominant topic from RSS item
 */
export function detectTopic(item: RSSItem): TopicType {
  const text = (item.title + " " + item.contentSnippet + " " + item.content).toLowerCase();
  
  // AI Agent detection
  if (text.includes("ai agent") || text.includes("autonomous agent") || 
      text.includes("agentic ai") || text.includes("ai agents") ||
      text.includes("deploy agents") || text.includes("agent deployment")) {
    return "ai_agent";
  }
  
  // Startup Accelerator detection
  if (text.includes("startup accelerator") || text.includes("accelerator program") ||
      text.includes("incubator") || text.includes("y combinator") ||
      text.includes("seed funding") || text.includes("early-stage funding")) {
    return "startup_accelerator";
  }
  
  // Web3 Infrastructure detection
  if (text.includes("web3") || text.includes("blockchain") || text.includes("crypto") ||
      text.includes("defi") || text.includes("nft") || text.includes("token") ||
      text.includes("decentralized") || text.includes("smart contract")) {
    return "web3_infrastructure";
  }
  
  // Automation System detection
  if (text.includes("workflow automation") || text.includes("process automation") ||
      text.includes("robotic process automation") || text.includes("rpa") ||
      text.includes("automation platform") || text.includes("automate workflows")) {
    return "automation_system";
  }
  
  // Workforce Automation detection
  if (text.includes("workforce automation") || text.includes("workplace automation") ||
      text.includes("employee automation") || text.includes("staff automation")) {
    return "workforce_automation";
  }
  
  // AI App Development detection
  if (text.includes("ai app") || text.includes("ai-powered app") ||
      text.includes("ai mobile app") || text.includes("ai application development") ||
      text.includes("build ai app") || text.includes("develop ai app")) {
    return "ai_app_development";
  }
  
  // UX/UI Design detection
  if (text.includes("ux design") || text.includes("ui design") ||
      text.includes("user experience") || text.includes("user interface") ||
      text.includes("design system") || text.includes("design thinking")) {
    return "ux_ui_design";
  }
  
  // Enterprise Digital Transformation detection
  if (text.includes("digital transformation") || text.includes("digital strategy") ||
      text.includes("enterprise transformation") || text.includes("digital initiative")) {
    return "enterprise_digital_transformation";
  }
  
  // AI Software detection
  if (text.includes("ai software") || text.includes("artificial intelligence software") ||
      text.includes("ai platform") || text.includes("ai solution")) {
    return "ai_software";
  }
  
  return "general";
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
        "Enterprise Deployment Patterns for AI Agents",
        "System Architecture Considerations for AI Agent Implementation",
        "Governance and Risk Management for AI Agents",
        "Industry Use Cases and Real-World Applications"
      ],
      description: "AI agent technology, enterprise deployment, system architecture, governance, and industry applications"
    },
    ai_app_development: {
      topic: "ai_app_development",
      h1: "AI App Development: Definition, Benefits, Implementation, and Best Practices",
      sections: [
        "What Is AI App Development?",
        "Key Technologies and Frameworks for AI Apps",
        "Implementation Strategies for AI-Powered Applications",
        "Cost Optimization and Performance Considerations",
        "Best Practices for AI App Development"
      ],
      description: "AI app development, technologies, implementation strategies, and best practices"
    },
    startup_accelerator: {
      topic: "startup_accelerator",
      h1: "What Is a Startup Accelerator? Definition, Benefits, Implementation, and Program Structure",
      sections: [
        "What Is a Startup Accelerator?",
        "Funding Mechanics and Equity Structures",
        "Ecosystem Incentives and Strategic Partnerships",
        "Strategic Implications for Founders",
        "Risks and Trade-Offs for Startup Founders"
      ],
      description: "Startup accelerators, funding mechanics, ecosystem incentives, and strategic implications"
    },
    automation_system: {
      topic: "automation_system",
      h1: "Workflow Automation: Definition, Benefits, Implementation, and Enterprise Guide",
      sections: [
        "What Is Workflow Automation?",
        "Orchestration Layers and Integration Patterns",
        "Cost Optimization Strategies for Automation",
        "Implementation Stages and Deployment Roadmap",
        "Operational Trade-Offs and Risk Considerations"
      ],
      description: "Workflow automation, orchestration, cost optimization, implementation stages, and trade-offs"
    },
    web3_infrastructure: {
      topic: "web3_infrastructure",
      h1: "Web3 Infrastructure: Definition, Benefits, Implementation, and Enterprise Applications",
      sections: [
        "What Is the Web3 Model?",
        "Infrastructure Stack and Technology Components",
        "Token Economics and Incentive Structures",
        "Regulatory Concerns and Compliance Requirements",
        "Enterprise Implications and Adoption Strategies"
      ],
      description: "Web3 infrastructure, technology stack, token economics, regulatory concerns, and enterprise adoption"
    },
    ux_ui_design: {
      topic: "ux_ui_design",
      h1: "UX/UI Design: Definition, Benefits, Implementation, and Best Practices",
      sections: [
        "What Is UX/UI Design?",
        "Design Systems and Component Libraries",
        "User Research and Testing Methodologies",
        "Implementation Strategies for Design Systems",
        "Measuring Design Impact and ROI"
      ],
      description: "UX/UI design, design systems, user research, implementation strategies, and design ROI"
    },
    enterprise_digital_transformation: {
      topic: "enterprise_digital_transformation",
      h1: "Enterprise Digital Transformation: Definition, Benefits, Implementation, and Strategic Guide",
      sections: [
        "What Is Enterprise Digital Transformation?",
        "Strategic Planning and Roadmap Development",
        "Technology Stack and Integration Requirements",
        "Change Management and Organizational Alignment",
        "Measuring Success and ROI of Digital Transformation"
      ],
      description: "Enterprise digital transformation, strategic planning, technology stack, change management, and ROI"
    },
    workforce_automation: {
      topic: "workforce_automation",
      h1: "Workforce Automation: Definition, Benefits, Implementation, and Enterprise Guide",
      sections: [
        "What Is Workforce Automation?",
        "Automation Technologies and Platform Options",
        "Implementation Strategies and Deployment Approaches",
        "Cost-Benefit Analysis and ROI Considerations",
        "Operational Trade-Offs and Risk Management"
      ],
      description: "Workforce automation, technologies, implementation strategies, cost-benefit analysis, and trade-offs"
    },
    ai_software: {
      topic: "ai_software",
      h1: "AI Software: Definition, Benefits, Implementation, and Enterprise Applications",
      sections: [
        "What Is AI Software?",
        "AI Software Architecture and Technology Stack",
        "Implementation Strategies for AI Software",
        "Integration Challenges and Solutions",
        "Enterprise Use Cases and Industry Applications"
      ],
      description: "AI software, architecture, implementation strategies, integration challenges, and enterprise use cases"
    },
    general: {
      topic: "general",
      h1: "Technology Innovation: Definition, Benefits, Implementation, and Strategic Applications",
      sections: [
        "What Is This Technology?",
        "Key Components and Architecture",
        "Implementation Strategies and Best Practices",
        "Benefits and Strategic Advantages",
        "Industry Applications and Use Cases"
      ],
      description: "Technology innovation, architecture, implementation, benefits, and industry applications"
    }
  };
  
  return blueprints[topic];
}
