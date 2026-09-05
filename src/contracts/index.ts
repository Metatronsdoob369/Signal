import { z } from "zod";
import { MAX_TOKEN_LENGTH } from "@/lib/hard-nos";
import { isValidHostname } from "@/lib/tenant";

const count = z.number().int().nonnegative().max(1_000_000);
const millis = z.number().nonnegative().max(3_600_000);

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

export const beaconMetadataSchema = z.strictObject({
  title: z.string().max(500).default(""),
  description: z.string().max(2000).default(""),
  canonical: z.string().max(2048).default(""),
  ogTitle: z.string().max(500).default(""),
  ogDescription: z.string().max(2000).default(""),
  ogImage: z.string().max(2048).default(""),
  viewport: z.string().max(200).default(""),
  robots: z.string().max(200).default(""),
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
  imagesCount: count.default(0),
  imagesWithAlt: count.default(0),
  linksCount: count.default(0),
  internalLinksCount: count.default(0),
  externalLinksCount: count.default(0),
  questionCount: count.default(0),
});

export const beaconStructureSchema = z.strictObject({
  hasDoctype: z.boolean().default(false),
  hasHtmlLang: z.boolean().default(false),
  hasMain: z.boolean().default(false),
  headingOrder: z.boolean().default(true),
  domDepth: z.number().int().nonnegative().max(10_000).default(0),
  semanticRatio: z.number().nonnegative().max(100).default(0),
});

export const beaconPerformanceSchema = z.strictObject({
  firstContentfulPaint: millis.optional(),
  largestContentfulPaint: millis.optional(),
  domContentLoaded: millis.optional(),
  resourceCount: count.optional(),
});

export const beaconAccessibilitySchema = z.strictObject({
  imagesWithoutAlt: count.default(0),
  linksWithoutText: count.default(0),
  inputsWithoutLabels: count.default(0),
  hasSkipLink: z.boolean().default(false),
  hasLandmarkRegions: z.boolean().default(false),
});

export const beaconAioSchema = z.strictObject({
  hasStructuredData: z.boolean().default(false),
  structuredDataCount: count.default(0),
  schemaTypes: z.array(z.string().max(80)).max(32).default([]),
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
  token: z.string().min(1).max(MAX_TOKEN_LENGTH),
  path: z.string().min(1).max(2048),
  t: z.string().max(500).default(""),
  d: z.string().max(2000).default(""),
});

export type ResolveQuery = z.infer<typeof resolveQuerySchema>;

export const beaconPayloadSchema = z.strictObject({
  token: z.string().min(1).max(MAX_TOKEN_LENGTH).optional(),
  url: z.string().url().max(2048),
  timestamp: z.string().max(64).optional(),
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
    viewport: "",
    robots: "",
  }),
  content: beaconContentSchema.default({
    wordCount: 0,
    headings: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 },
    h1Texts: [],
    imagesCount: 0,
    imagesWithAlt: 0,
    linksCount: 0,
    internalLinksCount: 0,
    externalLinksCount: 0,
    questionCount: 0,
  }),
  structure: beaconStructureSchema.default({
    hasDoctype: false,
    hasHtmlLang: false,
    hasMain: false,
    headingOrder: true,
    domDepth: 0,
    semanticRatio: 0,
  }),
  performance: beaconPerformanceSchema.default({}),
  accessibility: beaconAccessibilitySchema.default({
    imagesWithoutAlt: 0,
    linksWithoutText: 0,
    inputsWithoutLabels: 0,
    hasSkipLink: false,
    hasLandmarkRegions: false,
  }),
  aio: beaconAioSchema.default({
    hasStructuredData: false,
    structuredDataCount: 0,
    schemaTypes: [],
    hasFAQ: false,
    hasHowTo: false,
    hasClearDefinitions: false,
    questionCount: 0,
  }),
});

export type BeaconPayload = z.infer<typeof beaconPayloadSchema>;

export const scoreSchema = z.strictObject({
  seo: z.number().min(0).max(100),
  aio: z.number().min(0).max(100),
  performance: z.number().min(0).max(100),
  accessibility: z.number().min(0).max(100),
  bestPractices: z.number().min(0).max(100),
  overall: z.number().min(0).max(100),
});

export type Scores = z.infer<typeof scoreSchema>;

export const findingSchema = z.strictObject({
  category: z.enum(["seo", "aio", "performance", "accessibility", "best-practices"]),
  severity: z.enum(["critical", "warning", "info"]),
  title: z.string().max(200),
  message: z.string().max(1000),
  fix: z.string().max(500).optional(),
});

export type Finding = z.infer<typeof findingSchema>;
