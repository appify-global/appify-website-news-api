/**
 * Strict quality validation for articles before publishing
 */

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Generic sections that could apply to any topic - these should be rejected
 */
const GENERIC_SECTIONS = [
  "introduction",
  "conclusion",
  "summary",
  "overview",
  "key takeaways",
  "final thoughts",
  "in conclusion",
  "to sum up",
  "wrapping up",
];

/**
 * Validate article content before publishing.
 * Optionally pass metaDescription to validate SEO meta (warnings only).
 */
export function validateArticleContent(
  content: string,
  contentBlocks: Array<{ type: string; text?: string }>,
  primaryKeyword?: string,
  metaDescription?: string | null
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Enforce minimum word count of 800 words (practical minimum for quality SEO content)
  const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordCount < 800) {
    errors.push(`Article has only ${wordCount} words. Minimum required: 800 words.`);
  }

  // 2. Reject if duplicate sentences or paragraphs are detected
  const sentences = content
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20); // Only check substantial sentences

  const sentenceCounts = new Map<string, number>();
  sentences.forEach((sentence) => {
    const normalized = sentence.toLowerCase().replace(/\s+/g, " ");
    const count = sentenceCounts.get(normalized) || 0;
    sentenceCounts.set(normalized, count + 1);
  });

  const duplicateSentences = Array.from(sentenceCounts.entries()).filter(
    ([, count]) => count > 1
  );
  // Only reject if there are MANY duplicates (more than 30% of sentences are duplicates)
  // Some duplicates in source content are acceptable - RSS feeds sometimes have repeated content
  // Increased threshold to 30% to account for inherent repetition in RSS source material
  if (duplicateSentences.length > sentences.length * 0.3) {
    errors.push(
      `Found ${duplicateSentences.length} duplicate sentence(s) (${Math.round(duplicateSentences.length / sentences.length * 100)}% of content). Content must be original without excessive repetition.`
    );
  }

  // Check for duplicate paragraphs
  const paragraphs = contentBlocks
    .filter((b) => b.type === "paragraph" && b.text)
    .map((b) => b.text!.trim().toLowerCase().replace(/\s+/g, " "));

  const paragraphCounts = new Map<string, number>();
  paragraphs.forEach((para) => {
    if (para.length > 50) {
      // Only check substantial paragraphs
      const count = paragraphCounts.get(para) || 0;
      paragraphCounts.set(para, count + 1);
    }
  });

  const duplicateParagraphs = Array.from(paragraphCounts.entries()).filter(
    ([, count]) => count > 1
  );
  // Only reject if there are MANY duplicate paragraphs (more than 25% of paragraphs are duplicates)
  // Some duplicates in source content are acceptable - RSS feeds sometimes have repeated content
  if (duplicateParagraphs.length > paragraphs.length * 0.25) {
    errors.push(
      `Found ${duplicateParagraphs.length} duplicate paragraph(s) (${Math.round(duplicateParagraphs.length / paragraphs.length * 100)}% of content). Content must be original without excessive repetition.`
    );
  }

  // 3. Ensure primary keyword appears 2-6 times (allow more for multi-word keywords)
  if (primaryKeyword) {
    const keywordLower = primaryKeyword.toLowerCase();
    const contentLower = content.toLowerCase();
    const keywordMatches = (contentLower.match(new RegExp(keywordLower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    
    // For multi-word keywords (2+ words), allow up to 6 occurrences
    const maxOccurrences = primaryKeyword.split(/\s+/).length >= 2 ? 6 : 4;

    if (keywordMatches < 2) {
      errors.push(
        `Primary keyword "${primaryKeyword}" appears only ${keywordMatches} time(s). Must appear 2-${maxOccurrences} times.`
      );
    } else if (keywordMatches > maxOccurrences) {
      errors.push(
        `Primary keyword "${primaryKeyword}" appears ${keywordMatches} times. Must appear 2-${maxOccurrences} times only (keyword stuffing detected).`
      );
    }
    
    // Check keyword in strategic locations for better SEO
    const first100Words = content.split(/\s+/).slice(0, 100).join(" ").toLowerCase();
    if (!first100Words.includes(keywordLower)) {
      warnings.push(`Primary keyword "${primaryKeyword}" should appear in the first 100 words for better SEO.`);
    }
    
    // Check keyword in at least one H2
    const h2Headings = contentBlocks
      .filter(b => b.type === "heading" && b.text)
      .map(b => b.text!.toLowerCase());
    const keywordInHeading = h2Headings.some(h => h.includes(keywordLower));
    if (!keywordInHeading && h2Headings.length > 0) {
      warnings.push(`Primary keyword "${primaryKeyword}" should appear in at least one H2 heading for better SEO.`);
    }
  }

  // 4. Ensure each H2 section directly relates to the evergreen angle
  const h2Headings = contentBlocks
    .filter((b) => b.type === "heading" && b.text)
    .map((b) => b.text!.toLowerCase().trim());

  const genericH2Found = h2Headings.some((heading) =>
    GENERIC_SECTIONS.some((generic) => heading.includes(generic))
  );

  if (genericH2Found) {
    errors.push(
      `Found generic section heading(s) that could apply to any topic. All H2 sections must relate directly to the evergreen angle.`
    );
  }

  // Check if H2 headings are too generic (don't add specific value)
  const vagueHeadings = h2Headings.filter(
    (h) =>
      h.length < 10 || // Too short
      h.match(/^(what|why|how|when|where)$/i) || // Single question words
      h.match(/^(overview|summary|conclusion|introduction)$/i) // Generic terms
  );

  if (vagueHeadings.length > 0) {
    warnings.push(
      `Some H2 headings may be too generic: ${vagueHeadings.join(", ")}. Consider making them more specific to the evergreen angle.`
    );
  }

  // 5. Reject generic sections that could apply to any topic
  const contentLower = content.toLowerCase();
  const genericSectionPatterns = [
    /this (article|post|blog|content) (will|explores?|discusses?|covers?)/i,
    /in this (article|post|blog|guide)/i,
    /throughout this (article|post|blog)/i,
    /as we (have seen|discussed|explored)/i,
    /(let's|let us) (dive|explore|discuss|examine) (into|deeply)/i,
  ];

  const genericPhrasesFound = genericSectionPatterns.some((pattern) =>
    pattern.test(content)
  );

  if (genericPhrasesFound) {
    warnings.push(
      "Found generic phrases that could apply to any topic. Consider making content more specific to the evergreen angle."
    );
  }

  // Meta description (SEO snippet): warn if missing or over 160 chars
  if (metaDescription !== undefined) {
    if (!metaDescription || (typeof metaDescription === "string" && metaDescription.trim().length === 0)) {
      warnings.push("Meta description is missing. Add one for better search snippets (recommended 150–160 characters).");
    } else if (typeof metaDescription === "string" && metaDescription.length > 160) {
      warnings.push(
        `Meta description is ${metaDescription.length} characters (max 160 for search results). It may be truncated in search.`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
