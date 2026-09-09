import type { BeaconPayload, CrawlFacts, SchemaNode } from "@/contracts";
import type {
  Derived,
  HeadingHierarchy,
  RobotsMeta,
  RuleContext,
  SchemaSummary,
  UrlHygiene,
} from "./types";

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
  "will",
  "with",
  "your",
  "you",
]);

export function tokenize(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").split(" ")) {
    if (raw.length < 2 || STOPWORDS.has(raw)) continue;
    out.add(raw);
  }
  return out;
}

/** Share of the smaller token set that also appears in the larger one. 0 when either is empty. */
export function tokenOverlap(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const token of ta) if (tb.has(token)) shared += 1;
  return shared / Math.min(ta.size, tb.size);
}

export function headingHierarchy(levels: readonly number[]): HeadingHierarchy | null {
  if (!levels.length) return null;
  let skips = 0;
  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i] > levels[i - 1] + 1) skips += 1;
  }
  return { valid: skips === 0, skips, startsAtH1: levels[0] === 1 };
}

export function urlHygiene(url: URL): UrlHygiene {
  const path = url.pathname;
  const segments = path.split("/").filter(Boolean);
  const hasUppercase = /[A-Z]/.test(path);
  const hasUnderscore = path.includes("_");
  const queryParams = Array.from(url.searchParams.keys()).length;
  const issues: string[] = [];
  if (hasUppercase) issues.push("uppercase characters in the path");
  if (hasUnderscore) issues.push("underscores in the path");
  if (segments.length > 4) issues.push(`${segments.length} path levels`);
  if (queryParams > 2) issues.push(`${queryParams} query parameters`);
  return { hasUppercase, hasUnderscore, depth: segments.length, queryParams, issues };
}

export function parseRobotsMeta(content: string): RobotsMeta {
  const directives = new Set<string>();
  for (const part of content.toLowerCase().split(",")) {
    const trimmed = part.trim();
    if (trimmed) directives.add(trimmed);
  }
  return {
    directives,
    noindex: directives.has("noindex") || directives.has("none"),
    nosnippet: directives.has("nosnippet"),
    maxSnippetZero: directives.has("max-snippet:0"),
    noai: directives.has("noai") || directives.has("noimageai"),
  };
}

function stripWww(host: string): string {
  return host.toLowerCase().replace(/^www\./, "");
}

function normalizePath(path: string): string {
  const trimmed = path.replace(/\/+$/, "");
  return trimmed === "" ? "/" : trimmed;
}

/** True when the canonical points at this page (ignoring www, trailing slash, query, hash). */
export function canonicalMatches(pageUrl: URL, canonical: string): boolean | null {
  if (!canonical) return null;
  let target: URL;
  try {
    target = new URL(canonical, pageUrl);
  } catch {
    return false;
  }
  return (
    stripWww(target.hostname) === stripWww(pageUrl.hostname) &&
    normalizePath(target.pathname) === normalizePath(pageUrl.pathname)
  );
}

/**
 * Required property names per schema.org type. Presence of the key is checked, never its value.
 * Alternatives are separated by "|" (any one satisfies).
 */
export const SCHEMA_REQUIRED_KEYS: Readonly<Record<string, readonly string[]>> = {
  organization: ["name", "url"],
  person: ["name"],
  website: ["name", "url"],
  webpage: ["name|headline"],
  article: ["headline", "author", "datePublished"],
  blogposting: ["headline", "author", "datePublished"],
  newsarticle: ["headline", "author", "datePublished"],
  product: ["name", "description|offers"],
  faqpage: ["mainEntity"],
  howto: ["name", "step"],
  breadcrumblist: ["itemListElement"],
  localbusiness: ["name", "address"],
  softwareapplication: ["name", "applicationCategory|offers"],
  event: ["name", "startDate", "location"],
  recipe: ["name", "recipeIngredient|recipeInstructions"],
  service: ["name", "provider|description"],
};

const PAGE_TYPES = new Set([
  "article",
  "blogposting",
  "newsarticle",
  "product",
  "faqpage",
  "howto",
  "webpage",
  "aboutpage",
  "contactpage",
  "collectionpage",
  "profilepage",
  "service",
  "localbusiness",
  "softwareapplication",
  "event",
  "recipe",
  "course",
  "qapage",
]);

const ENTITY_TYPES = new Set(["organization", "person", "website", "localbusiness", "brand"]);
const ARTICLE_TYPES = new Set(["article", "blogposting", "newsarticle", "techarticle", "report"]);

export function summarizeSchema(nodes: readonly SchemaNode[], legacyTypes: readonly string[]): SchemaSummary {
  const types = new Set<string>();
  for (const node of nodes) types.add(node.type.toLowerCase());
  for (const type of legacyTypes) types.add(type.toLowerCase());

  let known = 0;
  let complete = 0;
  const missing: Array<{ type: string; keys: string[] }> = [];
  let entityNode = false;
  let sameAs = false;
  let hasDates = false;
  let hasAuthor = false;

  for (const node of nodes) {
    const type = node.type.toLowerCase();
    const keys = new Set(node.keys);
    if (ENTITY_TYPES.has(type)) {
      entityNode = true;
      if (keys.has("sameAs")) sameAs = true;
    }
    if (keys.has("datePublished") || keys.has("dateModified")) hasDates = true;
    if (keys.has("author")) hasAuthor = true;

    const required = SCHEMA_REQUIRED_KEYS[type];
    if (!required) continue;
    known += 1;
    const absent = required.filter((spec) => !spec.split("|").some((k) => keys.has(k)));
    if (absent.length === 0) complete += 1;
    else missing.push({ type: node.type, keys: absent });
  }

  if (!nodes.length) {
    for (const type of legacyTypes) if (ENTITY_TYPES.has(type.toLowerCase())) entityNode = true;
  }

  return { nodes: [...nodes], types, known, complete, missing, entityNode, sameAs, hasDates, hasAuthor };
}

export function hasPageType(types: ReadonlySet<string>): boolean {
  for (const type of types) if (PAGE_TYPES.has(type)) return true;
  return false;
}

export function isArticleLike(types: ReadonlySet<string>): boolean {
  for (const type of types) if (ARTICLE_TYPES.has(type)) return true;
  return false;
}

export function answerFirstRatio(words: readonly number[]): number | null {
  if (!words.length) return null;
  const answered = words.filter((w) => w >= 15 && w <= 80).length;
  return answered / words.length;
}

export function deriveContext(payload: BeaconPayload, crawl: CrawlFacts | null): RuleContext {
  const url = new URL(payload.url);
  const { metadata, content, aio } = payload;
  const h1 = content.h1Texts[0] ?? "";
  const schema = summarizeSchema(aio.schemaNodes, aio.schemaTypes);
  const headingTotal =
    content.headings.h2 + content.headings.h3 + content.headings.h4 + content.headings.h5 + content.headings.h6;

  const derived: Derived = {
    isHttps: url.protocol === "https:",
    urlHygiene: urlHygiene(url),
    headingHierarchy: headingHierarchy(content.headingLevels),
    titleH1Overlap: metadata.title && h1 ? tokenOverlap(metadata.title, h1) : null,
    titleOgOverlap: metadata.title && metadata.ogTitle ? tokenOverlap(metadata.title, metadata.ogTitle) : null,
    descriptionOgOverlap:
      metadata.description && metadata.ogDescription
        ? tokenOverlap(metadata.description, metadata.ogDescription)
        : null,
    canonicalMatches: canonicalMatches(url, metadata.canonical),
    robotsMeta: parseRobotsMeta(metadata.robots),
    schema,
    articleLike: isArticleLike(schema.types),
    imagesWithoutAlt: Math.max(
      payload.accessibility.imagesWithoutAlt,
      content.imagesCount - content.imagesWithAlt,
      0,
    ),
    answerFirstRatio: answerFirstRatio(content.questionAnswerWords),
    headingsPer300Words: content.wordCount > 0 ? headingTotal / (content.wordCount / 300) : null,
  };

  return { payload, url, crawl, derived };
}
