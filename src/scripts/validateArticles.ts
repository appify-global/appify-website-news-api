/**
 * Comprehensive Article Validation Script
 * Validates articles against Appify's SEO-first content guidelines
 */

import { prisma } from "../lib/prisma";

interface ArticleContentBlock {
  type: "paragraph" | "heading" | "subheading" | "image";
  text?: string;
  src?: string;
  alt?: string;
}

interface ValidationIssue {
  type: "error" | "warning" | "info";
  section: string;
  message: string;
  suggestion?: string;
}

interface ValidationResult {
  articleId: string;
  articleSlug: string;
  articleTitle: string;
  issues: ValidationIssue[];
  score: number;
}

// Banned phrases
const BANNED_PHRASES = [
  /in today['']s/gi,
  /rapidly evolving landscape/gi,
  /competitive advantage/gi,
  /this article explores/gi,
  /recently announced/gi,
  /on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi,
  /case study/gi,
];

// CTA patterns
const CTA_PATTERNS = [
  /contact us/gi,
  /get started/gi,
  /learn more/gi,
  /sign up/gi,
  /book a call/gi,
  /schedule a demo/gi,
  /request a quote/gi,
  /let['']s work together/gi,
  /reach out/gi,
  /get in touch/gi,
  /call to action/gi,
];

// Required sections with keywords
const REQUIRED_SECTIONS = {
  definition: ["definition", "what is", "overview", "introduction"],
  howItWorks: ["how it works", "mechanics", "architecture", "implementation", "how does"],
  tradeOffs: ["trade-off", "tradeoff", "risk", "challenge", "limitation", "drawback"],
  decisionFramework: ["decision", "framework", "when to", "criteria", "evaluate", "choose"],
  implementation: ["implementation", "steps", "process", "guide", "getting started"],
  conclusion: ["conclusion", "summary", "final thoughts", "takeaway"],
};

// Minimum word counts
const MIN_WORDS = {
  majorSection: 150,
  tradeOffParagraph: 120,
  bulletPoint: 50, // Bullet points should be expanded into full paragraphs (2-3 sentences minimum, 50+ words)
};

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function extractTextFromContent(content: ArticleContentBlock[]): string {
  return content
    .filter(block => block.type === 'paragraph' || block.type === 'heading' || block.type === 'subheading')
    .map(block => block.text || '')
    .map(stripHtml)
    .join(' ');
}

function findSection(content: ArticleContentBlock[], keywords: string[]): { found: boolean; text: string; index: number } {
  let sectionText = '';
  let foundIndex = -1;
  
  for (let i = 0; i < content.length; i++) {
    const block = content[i];
    if (block.type === 'heading' || block.type === 'subheading') {
      const headingText = (block.text || '').toLowerCase();
      if (keywords.some(keyword => headingText.includes(keyword))) {
        foundIndex = i;
        // Collect text until next heading
        for (let j = i + 1; j < content.length; j++) {
          const nextBlock = content[j];
          if (nextBlock.type === 'heading' || nextBlock.type === 'subheading') {
            break;
          }
          if (nextBlock.type === 'paragraph' && nextBlock.text) {
            sectionText += ' ' + stripHtml(nextBlock.text);
          }
        }
        return { found: true, text: sectionText.trim(), index: foundIndex };
      }
    }
  }
  
  return { found: false, text: '', index: -1 };
}

function detectBulletPoints(text: string): Array<{ text: string; wordCount: number; startIndex: number; endIndex: number }> {
  const bullets: Array<{ text: string; wordCount: number; startIndex: number; endIndex: number }> = [];
  
  // Match HTML list items
  const listItemRegex = /<li[^>]*>(.*?)<\/li>/gi;
  let match;
  while ((match = listItemRegex.exec(text)) !== null) {
    const itemText = stripHtml(match[1]);
    bullets.push({ 
      text: itemText, 
      wordCount: countWords(itemText),
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }
  
  // Match markdown-style bullets
  const markdownBulletRegex = /^[\s]*[-*+]\s+(.+)$/gm;
  while ((match = markdownBulletRegex.exec(text)) !== null) {
    const itemText = match[1].trim();
    bullets.push({ 
      text: itemText, 
      wordCount: countWords(itemText),
      startIndex: match.index,
      endIndex: match.index + match[0].length
    });
  }
  
  return bullets;
}

function detectCTAs(text: string): Array<{ pattern: string; match: string; index: number }> {
  const ctas: Array<{ pattern: string; match: string; index: number }> = [];
  
  CTA_PATTERNS.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      if (match.index !== undefined) {
        ctas.push({
          pattern: pattern.source,
          match: match[0],
          index: match.index
        });
      }
    }
  });
  
  return ctas;
}

export function validateArticle(article: any): ValidationResult {
  const issues: ValidationIssue[] = [];
  const content = (article.content || []) as ArticleContentBlock[];
  const fullText = extractTextFromContent(content);
  const wordCount = countWords(fullText);
  
  // 1. Check H1 (title)
  if (!article.title || article.title.length < 10) {
    issues.push({
      type: 'error',
      section: 'H1/Title',
      message: 'Title is too short or missing',
      suggestion: 'Ensure title contains primary keyword and is clear and authority-driven',
    });
  }
  
  // 2. Check for banned phrases
  BANNED_PHRASES.forEach(phrase => {
    const matches = fullText.match(phrase);
    if (matches) {
      issues.push({
        type: 'error',
        section: 'Content',
        message: `Found banned phrase: "${matches[0]}"`,
        suggestion: 'Remove or replace with more precise language',
      });
    }
  });
  
  // 3. Check required sections
  Object.entries(REQUIRED_SECTIONS).forEach(([sectionName, keywords]) => {
    const section = findSection(content, keywords);
    if (!section.found) {
      issues.push({
        type: 'error',
        section: sectionName.charAt(0).toUpperCase() + sectionName.slice(1),
        message: `Missing required section: ${sectionName}`,
        suggestion: `Add a section with heading containing one of: ${keywords.join(', ')}`,
      });
    } else {
      const sectionWordCount = countWords(section.text);
      if (sectionWordCount < MIN_WORDS.majorSection) {
        issues.push({
          type: 'warning',
          section: sectionName.charAt(0).toUpperCase() + sectionName.slice(1),
          message: `Section too short: ${sectionWordCount} words (minimum: ${MIN_WORDS.majorSection})`,
          suggestion: 'Expand section with more detail and depth',
        });
      }
    }
  });
  
  // 4. Check Trade-offs section specifically (must have paragraphs of 120+ words each)
  const tradeOffsSection = findSection(content, REQUIRED_SECTIONS.tradeOffs);
  if (tradeOffsSection.found) {
    const paragraphs = tradeOffsSection.text.split(/\n\n|\.\s+(?=[A-Z])/).filter(p => p.trim().length > 0);
    paragraphs.forEach((para, idx) => {
      const paraWordCount = countWords(para);
      if (paraWordCount < MIN_WORDS.tradeOffParagraph) {
        issues.push({
          type: 'warning',
          section: 'Trade-offs',
          message: `Trade-off paragraph ${idx + 1} too short: ${paraWordCount} words (minimum: ${MIN_WORDS.tradeOffParagraph})`,
          suggestion: 'Expand trade-off into a full paragraph with detailed explanation',
        });
      }
    });
  }
  
  // 5. Check for bullet points (should be expanded into paragraphs)
  content.forEach((block, idx) => {
    if (block.type === 'paragraph' && block.text) {
      const bullets = detectBulletPoints(block.text);
      bullets.forEach((bullet, bulletIdx) => {
        if (bullet.wordCount < MIN_WORDS.bulletPoint) {
          issues.push({
            type: 'error',
            section: `Content Block ${idx + 1}`,
            message: `Bullet point found that needs expansion: "${bullet.text.substring(0, 50)}..." (${bullet.wordCount} words)`,
            suggestion: `Expand bullet point into a full paragraph with 2-3 sentences minimum (minimum ${MIN_WORDS.bulletPoint} words). Each bullet should be a complete analytical paragraph with explanation, context, and detail.`,
          });
        }
      });
    }
  });
  
  // 6. Check for multiple CTAs
  const ctas = detectCTAs(fullText);
  if (ctas.length > 1) {
    issues.push({
      type: 'error',
      section: 'Conclusion',
      message: `Found ${ctas.length} CTAs (maximum allowed: 1)`,
      suggestion: 'Remove extra CTAs, keep only one optional CTA in conclusion',
    });
  }
  
  // 7. Check SEO - primary keyword in title
  const titleWords = article.title.toLowerCase().split(/\s+/);
  if (titleWords.length < 2 || titleWords.length > 6) {
    issues.push({
      type: 'warning',
      section: 'SEO',
      message: 'Title should contain primary keyword (2-6 words)',
      suggestion: 'Ensure title naturally contains the primary keyword',
    });
  }
  
  // 8. Check for FAQ sections (banned)
  const hasFAQ = /faq|frequently asked|questions? and answers?/gi.test(fullText);
  if (hasFAQ) {
    issues.push({
      type: 'error',
      section: 'Content',
      message: 'FAQ section found (banned)',
      suggestion: 'Remove FAQ section',
    });
  }

  // 9. Meta description (SEO snippet: 150-160 chars recommended, max 160)
  const metaDesc = article.metaDescription;
  if (!metaDesc || (typeof metaDesc === "string" && metaDesc.trim().length === 0)) {
    issues.push({
      type: 'warning',
      section: 'SEO',
      message: 'Meta description is missing',
      suggestion: 'Add a meta description (150-160 characters) for better search snippets',
    });
  } else if (typeof metaDesc === "string" && metaDesc.length > 160) {
    issues.push({
      type: 'warning',
      section: 'SEO',
      message: `Meta description is ${metaDesc.length} characters (max 160)`,
      suggestion: 'Shorten to 150-160 characters so it is not truncated in search results',
    });
  }

  // 10. Meta title (SEO title tag: max 60 chars)
  const metaTitle = article.metaTitle;
  if (!metaTitle || (typeof metaTitle === "string" && metaTitle.trim().length === 0)) {
    issues.push({
      type: 'warning',
      section: 'SEO',
      message: 'Meta title is missing',
      suggestion: 'Add a meta title (max 60 characters) for search results',
    });
  } else if (typeof metaTitle === "string" && metaTitle.length > 60) {
    issues.push({
      type: 'warning',
      section: 'SEO',
      message: `Meta title is ${metaTitle.length} characters (max 60)`,
      suggestion: 'Shorten to 60 characters so it is not truncated in search results',
    });
  }
  
  // Calculate score (0-100)
  const errorCount = issues.filter(i => i.type === 'error').length;
  const warningCount = issues.filter(i => i.type === 'warning').length;
  const score = Math.max(0, 100 - (errorCount * 15) - (warningCount * 5));
  
  return {
    articleId: article.id,
    articleSlug: article.slug,
    articleTitle: article.title,
    issues,
    score,
  };
}

export async function validateAllArticles(): Promise<ValidationResult[]> {
  console.log('🔍 Starting article validation...\n');
  
  const articles = await prisma.article.findMany({
    where: { status: 'published' },
    select: {
      id: true,
      slug: true,
      title: true,
      content: true,
      topics: true,
      metaDescription: true,
      metaTitle: true,
    },
  });
  
  if (articles.length === 0) {
    console.log('❌ No published articles found to validate');
    return [];
  }
  
  console.log(`✅ Found ${articles.length} published articles\n`);
  
  const results: ValidationResult[] = articles.map(validateArticle);
  
  // Print results
  results.forEach(result => {
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📄 Article: ${result.articleTitle}`);
    console.log(`   Slug: ${result.articleSlug}`);
    console.log(`   Score: ${result.score}/100`);
    console.log(`   Issues: ${result.issues.length} (${result.issues.filter(i => i.type === 'error').length} errors, ${result.issues.filter(i => i.type === 'warning').length} warnings)`);
    
    if (result.issues.length > 0) {
      console.log(`\n   Issues:`);
      result.issues.forEach((issue, idx) => {
        const icon = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`   ${idx + 1}. ${icon} [${issue.section}] ${issue.message}`);
        if (issue.suggestion) {
          console.log(`      💡 Suggestion: ${issue.suggestion}`);
        }
      });
    } else {
      console.log(`   ✅ No issues found!`);
    }
  });
  
  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 VALIDATION SUMMARY`);
  console.log(`   Total articles: ${results.length}`);
  console.log(`   Articles with errors: ${results.filter(r => r.issues.some(i => i.type === 'error')).length}`);
  console.log(`   Articles with warnings: ${results.filter(r => r.issues.some(i => i.type === 'warning')).length}`);
  console.log(`   Average score: ${(results.reduce((sum, r) => sum + r.score, 0) / results.length).toFixed(1)}/100`);
  
  // List articles needing attention
  const needsAttention = results.filter(r => r.score < 70);
  if (needsAttention.length > 0) {
    console.log(`\n   ⚠️  Articles needing attention (score < 70):`);
    needsAttention.forEach(r => {
      console.log(`      - ${r.articleTitle} (${r.score}/100)`);
    });
  }
  
  return results;
}

// Run validation if called directly
if (require.main === module) {
  validateAllArticles()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Validation failed:', error);
      process.exit(1);
    });
}
