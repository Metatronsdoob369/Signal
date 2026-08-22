import type { BeaconPayload, Finding, Scores } from "@/contracts";

const AIO_BASE = 50;
const AIO_STRUCTURED_DATA = 15;
const AIO_FAQ = 10;
const AIO_HOWTO = 10;
const AIO_DEFINITIONS = 10;
const AIO_QUESTIONS = 5;

export const AIO_WEIGHTS = {
  base: AIO_BASE,
  structuredData: AIO_STRUCTURED_DATA,
  faq: AIO_FAQ,
  howTo: AIO_HOWTO,
  definitions: AIO_DEFINITIONS,
  questions: AIO_QUESTIONS,
} as const;

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreSeo(payload: BeaconPayload): { score: number; findings: Finding[] } {
  const { metadata, content, structure } = payload;
  const findings: Finding[] = [];
  let score = 50;

  if (!metadata.title) {
    findings.push({
      category: "seo",
      severity: "critical",
      title: "Missing Page Title",
      message: "The page does not have a title tag.",
      fix: "Add a descriptive title tag (50-60 characters).",
    });
  } else if (metadata.title.length < 30) {
    findings.push({
      category: "seo",
      severity: "warning",
      title: "Title Too Short",
      message: `Title is only ${metadata.title.length} characters.`,
      fix: "Expand the title toward 50-60 characters.",
    });
    score += 5;
  } else if (metadata.title.length > 60) {
    findings.push({
      category: "seo",
      severity: "warning",
      title: "Title Too Long",
      message: `Title is ${metadata.title.length} characters.`,
      fix: "Shorten the title to 60 characters or less.",
    });
    score += 8;
  } else {
    score += 10;
  }

  if (!metadata.description) {
    findings.push({
      category: "seo",
      severity: "critical",
      title: "Missing Meta Description",
      message: "The page lacks a meta description.",
      fix: "Add a meta description of 150-160 characters.",
    });
  } else if (metadata.description.length < 100) {
    findings.push({
      category: "seo",
      severity: "warning",
      title: "Meta Description Too Short",
      message: `Description is only ${metadata.description.length} characters.`,
      fix: "Expand to 150-160 characters.",
    });
    score += 5;
  } else {
    score += 10;
  }

  if (metadata.canonical) score += 5;
  else {
    findings.push({
      category: "seo",
      severity: "info",
      title: "Missing Canonical URL",
      message: "No canonical link tag found.",
      fix: "Add a canonical URL to prevent duplicate content issues.",
    });
  }

  if (metadata.ogTitle) score += 5;
  if (metadata.ogDescription) score += 5;
  if (metadata.ogImage) score += 5;

  if (content.headings.h1 === 0) {
    findings.push({
      category: "seo",
      severity: "critical",
      title: "Missing H1 Heading",
      message: "The page has no H1 heading.",
      fix: "Add a single descriptive H1.",
    });
  } else if (content.headings.h1 > 1) {
    findings.push({
      category: "seo",
      severity: "warning",
      title: "Multiple H1 Headings",
      message: `Found ${content.headings.h1} H1 tags.`,
      fix: "Use a single H1 and H2-H6 for subheadings.",
    });
    score += 3;
  } else {
    score += 5;
  }

  if (content.headings.h2 > 0) score += 5;
  if (content.wordCount > 300) score += 5;
  else if (content.wordCount > 0) {
    findings.push({
      category: "seo",
      severity: "warning",
      title: "Thin Content",
      message: `Page has only ${content.wordCount} words.`,
      fix: "Expand content to at least 300 words when the page warrants it.",
    });
  }

  if (structure.headingOrder) score += 5;

  const imagesWithoutAlt = Math.max(0, content.imagesCount - content.imagesWithAlt);
  if (imagesWithoutAlt > 0) {
    findings.push({
      category: "seo",
      severity: "warning",
      title: "Images Missing Alt Text",
      message: `${imagesWithoutAlt} image(s) are missing alt attributes.`,
      fix: "Add descriptive alt text to all images.",
    });
  }

  return { score: clamp(score), findings };
}

function scoreAio(payload: BeaconPayload): { score: number; findings: Finding[] } {
  const { aio, content } = payload;
  const findings: Finding[] = [];
  let score = AIO_BASE;
  const questionCount = aio.questionCount || content.questionCount || 0;

  if (aio.hasStructuredData) {
    score += AIO_STRUCTURED_DATA;
  } else {
    findings.push({
      category: "aio",
      severity: "critical",
      title: "No Structured Data",
      message: "The page lacks schema.org structured data.",
      fix: "Add JSON-LD relevant to the page type (Article, FAQ, Product, etc.).",
    });
  }

  if (aio.hasFAQ) {
    score += AIO_FAQ;
  } else if (questionCount > 0) {
    findings.push({
      category: "aio",
      severity: "warning",
      title: "FAQ Structure Missing",
      message: "Page contains questions but lacks FAQ structured data.",
      fix: "Mark Q&A content with FAQPage schema.",
    });
  }

  if (aio.hasHowTo) {
    score += AIO_HOWTO;
  } else {
    findings.push({
      category: "aio",
      severity: "info",
      title: "Consider How-To Schema",
      message: "If this page contains instructions, add HowTo structured data.",
      fix: "Use HowTo schema for step-based content.",
    });
  }

  if (aio.hasClearDefinitions) {
    score += AIO_DEFINITIONS;
  } else if (content.wordCount > 500) {
    findings.push({
      category: "aio",
      severity: "info",
      title: "Add Clear Definitions",
      message: "Long-form pages benefit from explicit definition patterns.",
      fix: 'Include definitions using "is", "means", or "refers to".',
    });
  }

  if (questionCount > 3) {
    score += AIO_QUESTIONS;
  }

  if (aio.avgSentenceLength && aio.avgSentenceLength > 25) {
    findings.push({
      category: "aio",
      severity: "warning",
      title: "Complex Sentences",
      message: `Average sentence length is ${aio.avgSentenceLength} words.`,
      fix: "Aim for 15-20 words per sentence.",
    });
  }

  return { score: clamp(score), findings };
}

function scorePerformance(payload: BeaconPayload): { score: number; findings: Finding[] } {
  const { performance } = payload;
  const findings: Finding[] = [];
  let score = 50;

  if (performance.firstContentfulPaint !== undefined) {
    if (performance.firstContentfulPaint < 1500) score += 20;
    else if (performance.firstContentfulPaint < 3000) score += 10;
    else {
      findings.push({
        category: "performance",
        severity: "critical",
        title: "Slow First Contentful Paint",
        message: `FCP is ${performance.firstContentfulPaint}ms.`,
        fix: "Optimize images and critical rendering path.",
      });
    }
  }

  if (performance.largestContentfulPaint !== undefined) {
    if (performance.largestContentfulPaint < 2500) score += 20;
    else if (performance.largestContentfulPaint < 4000) score += 10;
    else {
      findings.push({
        category: "performance",
        severity: "warning",
        title: "Slow Largest Contentful Paint",
        message: `LCP is ${performance.largestContentfulPaint}ms.`,
        fix: "Optimize the largest image or text block.",
      });
    }
  }

  if (performance.domContentLoaded !== undefined && performance.domContentLoaded < 2000) {
    score += 10;
  }

  if (performance.resourceCount !== undefined && performance.resourceCount > 100) {
    findings.push({
      category: "performance",
      severity: "warning",
      title: "Too Many Resources",
      message: `Page loads ${performance.resourceCount} resources.`,
      fix: "Remove unused assets and combine where possible.",
    });
  }

  return { score: clamp(score), findings };
}

function scoreAccessibility(payload: BeaconPayload): { score: number; findings: Finding[] } {
  const { accessibility, content } = payload;
  const findings: Finding[] = [];
  let score = 100;

  const imagesWithoutAlt =
    accessibility.imagesWithoutAlt || Math.max(0, content.imagesCount - content.imagesWithAlt);

  if (imagesWithoutAlt > 0) {
    score -= imagesWithoutAlt * 5;
    findings.push({
      category: "accessibility",
      severity: "critical",
      title: "Images Missing Alt Text",
      message: `${imagesWithoutAlt} image(s) lack alt attributes.`,
      fix: "Add descriptive alt text to all images.",
    });
  }

  if (accessibility.linksWithoutText > 0) {
    score -= accessibility.linksWithoutText * 3;
    findings.push({
      category: "accessibility",
      severity: "warning",
      title: "Links Without Accessible Text",
      message: `${accessibility.linksWithoutText} link(s) have no accessible text.`,
      fix: "Add text content or aria-label to all links.",
    });
  }

  if (accessibility.inputsWithoutLabels > 0) {
    score -= accessibility.inputsWithoutLabels * 5;
    findings.push({
      category: "accessibility",
      severity: "critical",
      title: "Form Inputs Without Labels",
      message: `${accessibility.inputsWithoutLabels} input(s) lack associated labels.`,
      fix: "Add label elements or aria-label attributes.",
    });
  }

  if (!accessibility.hasSkipLink) {
    score -= 10;
    findings.push({
      category: "accessibility",
      severity: "info",
      title: "No Skip Link",
      message: "Page lacks a skip-to-content link.",
      fix: "Add a skip link as the first focusable element.",
    });
  }

  if (!accessibility.hasLandmarkRegions) {
    score -= 10;
    findings.push({
      category: "accessibility",
      severity: "info",
      title: "Missing Landmark Regions",
      message: "Page lacks semantic landmark regions.",
      fix: "Use semantic HTML5 elements or ARIA landmarks.",
    });
  }

  return { score: clamp(score), findings };
}

function scoreBestPractices(payload: BeaconPayload): { score: number; findings: Finding[] } {
  const { structure, metadata } = payload;
  const findings: Finding[] = [];
  let score = 50;

  if (structure.hasDoctype) score += 10;
  else {
    findings.push({
      category: "best-practices",
      severity: "critical",
      title: "Missing DOCTYPE",
      message: "Page lacks DOCTYPE declaration.",
      fix: "Add <!DOCTYPE html> at the start of the document.",
    });
  }

  if (structure.hasHtmlLang) score += 10;
  else {
    findings.push({
      category: "best-practices",
      severity: "warning",
      title: "Missing HTML Language",
      message: "The html element lacks a lang attribute.",
      fix: 'Add lang="en" (or the correct language) to the html element.',
    });
  }

  if (structure.hasMain) score += 10;
  if (structure.semanticRatio > 10) score += 10;
  if (structure.domDepth > 0 && structure.domDepth < 15) score += 10;

  if (!metadata.viewport) {
    findings.push({
      category: "best-practices",
      severity: "critical",
      title: "Missing Viewport Meta",
      message: "No viewport meta tag found.",
      fix: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
    });
  }

  return { score: clamp(score), findings };
}

export function scoreAudit(payload: BeaconPayload): { scores: Scores; findings: Finding[] } {
  const seo = scoreSeo(payload);
  const aio = scoreAio(payload);
  const performance = scorePerformance(payload);
  const accessibility = scoreAccessibility(payload);
  const bestPractices = scoreBestPractices(payload);

  const findings = [
    ...seo.findings,
    ...aio.findings,
    ...performance.findings,
    ...accessibility.findings,
    ...bestPractices.findings,
  ].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 } as const;
    return order[a.severity] - order[b.severity];
  });

  const scores: Scores = {
    seo: seo.score,
    aio: aio.score,
    performance: performance.score,
    accessibility: accessibility.score,
    bestPractices: bestPractices.score,
    overall: clamp(
      (seo.score +
        aio.score +
        performance.score +
        accessibility.score +
        bestPractices.score) /
        5,
    ),
  };

  return { scores, findings };
}
