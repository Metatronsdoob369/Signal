import { z } from "zod";
import { MAX_TOKEN_LENGTH } from "@/lib/hard-nos";
import { isValidHostname } from "@/lib/tenant";

const count = z.number().int().nonnegative().max(1_000_000);
const millis = z.number().nonnegative().max(3_600_000);
const ratio = z.number().nonnegative().max(100);

export const createSiteSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(1)
    .max(253)
    .transform((value) => value.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase())
    .refine(isValidHostname),
  name: z.string().trim().max(200).optional(),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;

/**
 * Wire contracts for the pack beacon.
 *
 * Every field is a structured observation (count, boolean, bounded enum, short
 * label). The pack never ships page prose, markup, or attribute values beyond
 * the head metadata that search engines already index. Fields added in v0.2
 * are optional with defaults so a v0.1 pack still validates.
 */

export const beaconMetadataSchema = z.strictObject({
  title: z.string().max(500).default(""),
  description: z.string().max(2000).default(""),
  canonical: z.string().max(2048).default(""),
  ogTitle: z.string().max(500).default(""),
  ogDescription: z.string().max(2000).default(""),
  ogImage: z.string().max(2048).default(""),
  ogUrl: z.string().max(2048).default(""),
  twitterCard: z.string().max(64).default(""),
  viewport: z.string().max(200).default(""),
  robots: z.string().max(200).default(""),
  author: z.string().max(200).default(""),
  publishedTime: z.string().max(64).default(""),
  modifiedTime: z.string().max(64).default(""),
  hreflangCount: count.default(0),
});

export const beaconContentSchema = z.strictObject({
  wordCount: count.default(0),
  headings: z
    .strictObject({
      h1: count.default(0),
      h2: count.default(0),
      h3: count.default(0),
      h4: count.default(0),
      h5: count.default(0),
      h6: count.default(0),
    })
    .default({ h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 }),
  h1Texts: z.array(z.string().max(200)).max(10).default([]),
  /** Heading levels in document order, capped. Hierarchy is derived server-side. */
  headingLevels: z.array(z.number().int().min(1).max(6)).max(200).default([]),
  emptyHeadingCount: count.default(0),
  /** Headings phrased as questions (end with "?" or open with an interrogative). */
  questionHeadingCount: count.default(0),
  /** For each question heading: word count of the first paragraph that follows it (0 = none). */
  questionAnswerWords: z.array(count).max(60).default([]),
  hasSummaryBlock: z.boolean().default(false),
  paragraphCount: count.default(0),
  avgParagraphWords: ratio.max(10_000).default(0),
  listCount: count.default(0),
  tableCount: count.default(0),
  sentenceCount: count.default(0),
  /** Sentences shaped like definitions ("X is a …", "refers to", "is defined as"). */
  definitionSentenceCount: count.default(0),
  imagesCount: count.default(0),
  imagesWithAlt: count.default(0),
  imagesWithDimensions: count.default(0),
  imagesLazy: count.default(0),
  linksCount: count.default(0),
  internalLinksCount: count.default(0),
  externalLinksCount: count.default(0),
  /** Anchors whose text is a stock phrase ("click here", "read more"). */
  genericAnchorCount: count.default(0),
  questionCount: count.default(0),
  timeElementCount: count.default(0),
  hasByline: z.boolean().default(false),
});

export const beaconStructureSchema = z.strictObject({
  hasDoctype: z.boolean().default(false),
  hasHtmlLang: z.boolean().default(false),
  hasMain: z.boolean().default(false),
  headingOrder: z.boolean().default(true),
  domDepth: z.number().int().nonnegative().max(10_000).default(0),
  semanticRatio: ratio.default(0),
  /** `<head>` scripts with src and neither async, defer, nor type=module. */
  headScriptsBlocking: count.default(0),
  thirdPartyScriptCount: count.default(0),
  /** Resources requested over http: while the page is https:. */
  mixedContentCount: count.default(0),
});

export const beaconPerformanceSchema = z.strictObject({
  timeToFirstByte: millis.optional(),
  firstContentfulPaint: millis.optional(),
  largestContentfulPaint: millis.optional(),
  domContentLoaded: millis.optional(),
  /** Unitless layout-shift score as observed at send time. */
  cumulativeLayoutShift: z.number().nonnegative().max(100).optional(),
  interactionToNextPaint: millis.optional(),
  resourceCount: count.optional(),
  transferBytes: z.number().int().nonnegative().max(2_000_000_000).optional(),
});

export const beaconAccessibilitySchema = z.strictObject({
  imagesWithoutAlt: count.default(0),
  linksWithoutText: count.default(0),
  buttonsWithoutText: count.default(0),
  inputsWithoutLabels: count.default(0),
  hasSkipLink: z.boolean().default(false),
  hasLandmarkRegions: z.boolean().default(false),
});

/** One JSON-LD node: its @type and the names of its top-level properties. Values never travel. */
export const schemaNodeSchema = z.strictObject({
  type: z.string().max(80),
  keys: z.array(z.string().max(40)).max(40).default([]),
});

export type SchemaNode = z.infer<typeof schemaNodeSchema>;

export const beaconAioSchema = z.strictObject({
  hasStructuredData: z.boolean().default(false),
  structuredDataCount: count.default(0),
  schemaTypes: z.array(z.string().max(80)).max(32).default([]),
  schemaNodes: z.array(schemaNodeSchema).max(32).default([]),
  schemaParseErrors: count.default(0),
  hasFAQ: z.boolean().default(false),
  hasHowTo: z.boolean().default(false),
  hasClearDefinitions: z.boolean().default(false),
  questionCount: count.default(0),
  avgSentenceLength: z.number().nonnegative().max(10_000).optional(),
});

export const experimentEventSchema = z.strictObject({
  type: z.enum(["impression", "engage", "vital"]),
  metric: z.string().max(32).optional(),
  value: z.number().min(0).max(1_000_000).default(0),
});

export const resolveQuerySchema = z.object({
  key: z.string().min(1).max(MAX_TOKEN_LENGTH),
  path: z.string().min(1).max(2048),
  t: z.string().max(500).default(""),
  d: z.string().max(2000).default(""),
});

export type ResolveQuery = z.infer<typeof resolveQuerySchema>;

export const beaconPayloadSchema = z.strictObject({
  key: z.string().min(1).max(MAX_TOKEN_LENGTH).optional(),
  url: z.string().url().max(2048),
  timestamp: z.string().max(64).optional(),
  packVersion: z.string().max(16).optional(),
  intent: z.enum(["audit", "experiment"]).default("audit"),
  variantId: z.string().uuid().optional(),
  events: z.array(experimentEventSchema).max(16).default([]),
  metadata: beaconMetadataSchema.default({
    title: "",
    description: "",
    canonical: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    ogUrl: "",
    twitterCard: "",
    viewport: "",
    robots: "",
    author: "",
    publishedTime: "",
    modifiedTime: "",
    hreflangCount: 0,
  }),
  content: beaconContentSchema.default({
    wordCount: 0,
    headings: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
    h1Texts: [],
    headingLevels: [],
    emptyHeadingCount: 0,
    questionHeadingCount: 0,
    questionAnswerWords: [],
    hasSummaryBlock: false,
    paragraphCount: 0,
    avgParagraphWords: 0,
    listCount: 0,
    tableCount: 0,
    sentenceCount: 0,
    definitionSentenceCount: 0,
    imagesCount: 0,
    imagesWithAlt: 0,
    imagesWithDimensions: 0,
    imagesLazy: 0,
    linksCount: 0,
    internalLinksCount: 0,
    externalLinksCount: 0,
    genericAnchorCount: 0,
    questionCount: 0,
    timeElementCount: 0,
    hasByline: false,
  }),
  structure: beaconStructureSchema.default({
    hasDoctype: false,
    hasHtmlLang: false,
    hasMain: false,
    headingOrder: true,
    domDepth: 0,
    semanticRatio: 0,
    headScriptsBlocking: 0,
    thirdPartyScriptCount: 0,
    mixedContentCount: 0,
  }),
  performance: beaconPerformanceSchema.default({}),
  accessibility: beaconAccessibilitySchema.default({
    imagesWithoutAlt: 0,
    linksWithoutText: 0,
    buttonsWithoutText: 0,
    inputsWithoutLabels: 0,
    hasSkipLink: false,
    hasLandmarkRegions: false,
  }),
  aio: beaconAioSchema.default({
    hasStructuredData: false,
    structuredDataCount: 0,
    schemaTypes: [],
    schemaNodes: [],
    schemaParseErrors: 0,
    hasFAQ: false,
    hasHowTo: false,
    hasClearDefinitions: false,
    questionCount: 0,
  }),
});

export type BeaconPayload = z.infer<typeof beaconPayloadSchema>;

export const AIO_DIMENSIONS = [
  "crawl",
  "structure",
  "extractability",
  "entity",
  "consistency",
] as const;

export type AioDimension = (typeof AIO_DIMENSIONS)[number];

export const aioDimensionScoreSchema = z.strictObject({
  score: z.number().min(0).max(100).nullable(),
  applicable: z.number().int().nonnegative(),
  passed: z.number().int().nonnegative(),
});

export type AioDimensionScore = z.infer<typeof aioDimensionScoreSchema>;

export const scoreSchema = z.strictObject({
  seo: z.number().min(0).max(100),
  aio: z.number().min(0).max(100),
  performance: z.number().min(0).max(100),
  accessibility: z.number().min(0).max(100),
  bestPractices: z.number().min(0).max(100),
  overall: z.number().min(0).max(100),
  aioDimensions: z.record(z.enum(AIO_DIMENSIONS), aioDimensionScoreSchema).optional(),
});

export type Scores = z.infer<typeof scoreSchema>;

export const findingSchema = z.strictObject({
  category: z.enum(["seo", "aio", "performance", "accessibility", "best-practices"]),
  severity: z.enum(["critical", "warning", "info"]),
  title: z.string().max(200),
  message: z.string().max(1000),
  fix: z.string().max(500).optional(),
  ruleId: z.string().max(80).optional(),
  dimension: z.enum(AIO_DIMENSIONS).optional(),
});

export type Finding = z.infer<typeof findingSchema>;

/** Which robots.txt policy a user-agent token resolves to for the site root. */
export const crawlAccessSchema = z.enum(["allow", "disallow", "unspecified"]);

export type CrawlAccess = z.infer<typeof crawlAccessSchema>;

export const crawlFactsSchema = z.strictObject({
  fetchedAt: z.string().max(64),
  domain: z.string().max(253),
  robots: z.strictObject({
    status: z.enum(["ok", "missing", "error"]),
    sitemapDeclared: z.boolean(),
    disallowAll: z.boolean(),
    bots: z.record(z.string().max(64), crawlAccessSchema),
  }),
  llmsTxt: z.strictObject({
    status: z.enum(["ok", "missing", "error"]),
  }),
});

export type CrawlFacts = z.infer<typeof crawlFactsSchema>;
