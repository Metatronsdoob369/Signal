import { z } from "zod";

export const createSiteSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(1)
    .max(253)
    .transform((value) => value.replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase()),
  name: z.string().trim().max(200).optional(),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;

export const beaconMetadataSchema = z.object({
  title: z.string().default(""),
  description: z.string().default(""),
  canonical: z.string().default(""),
  ogTitle: z.string().default(""),
  ogDescription: z.string().default(""),
  ogImage: z.string().default(""),
  viewport: z.string().default(""),
  robots: z.string().default(""),
});

export const beaconContentSchema = z.object({
  wordCount: z.number().int().nonnegative().default(0),
  headings: z
    .object({
      h1: z.number().int().nonnegative().default(0),
      h2: z.number().int().nonnegative().default(0),
      h3: z.number().int().nonnegative().default(0),
      h4: z.number().int().nonnegative().default(0),
      h5: z.number().int().nonnegative().default(0),
      h6: z.number().int().nonnegative().default(0),
    })
    .default({ h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 }),
  h1Texts: z.array(z.string()).default([]),
  imagesCount: z.number().int().nonnegative().default(0),
  imagesWithAlt: z.number().int().nonnegative().default(0),
  linksCount: z.number().int().nonnegative().default(0),
  internalLinksCount: z.number().int().nonnegative().default(0),
  externalLinksCount: z.number().int().nonnegative().default(0),
  questionCount: z.number().int().nonnegative().default(0),
});

export const beaconStructureSchema = z.object({
  hasDoctype: z.boolean().default(false),
  hasHtmlLang: z.boolean().default(false),
  hasMain: z.boolean().default(false),
  headingOrder: z.boolean().default(true),
  domDepth: z.number().int().nonnegative().default(0),
  semanticRatio: z.number().nonnegative().default(0),
});

export const beaconPerformanceSchema = z.object({
  firstContentfulPaint: z.number().nonnegative().optional(),
  largestContentfulPaint: z.number().nonnegative().optional(),
  domContentLoaded: z.number().nonnegative().optional(),
  resourceCount: z.number().int().nonnegative().optional(),
});

export const beaconAccessibilitySchema = z.object({
  imagesWithoutAlt: z.number().int().nonnegative().default(0),
  linksWithoutText: z.number().int().nonnegative().default(0),
  inputsWithoutLabels: z.number().int().nonnegative().default(0),
  hasSkipLink: z.boolean().default(false),
  hasLandmarkRegions: z.boolean().default(false),
});

export const beaconAioSchema = z.object({
  hasStructuredData: z.boolean().default(false),
  structuredDataCount: z.number().int().nonnegative().default(0),
  schemaTypes: z.array(z.string()).default([]),
  hasFAQ: z.boolean().default(false),
  hasHowTo: z.boolean().default(false),
  hasClearDefinitions: z.boolean().default(false),
  questionCount: z.number().int().nonnegative().default(0),
  avgSentenceLength: z.number().nonnegative().optional(),
});

export const beaconPayloadSchema = z.object({
  token: z.string().min(1).optional(),
  url: z.string().url(),
  timestamp: z.string().optional(),
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

export const scoreSchema = z.object({
  seo: z.number().min(0).max(100),
  aio: z.number().min(0).max(100),
  performance: z.number().min(0).max(100),
  accessibility: z.number().min(0).max(100),
  bestPractices: z.number().min(0).max(100),
  overall: z.number().min(0).max(100),
});

export type Scores = z.infer<typeof scoreSchema>;

export const findingSchema = z.object({
  category: z.enum(["seo", "aio", "performance", "accessibility", "best-practices"]),
  severity: z.enum(["critical", "warning", "info"]),
  title: z.string(),
  message: z.string(),
  fix: z.string().optional(),
});

export type Finding = z.infer<typeof findingSchema>;
