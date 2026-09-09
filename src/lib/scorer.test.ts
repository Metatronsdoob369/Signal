import { describe, expect, it } from "vitest";
import { beaconPayloadSchema } from "@/contracts";
import { AIO_DIMENSION_WEIGHTS, RULE_WEIGHTS_VERSION, scoreAudit } from "@/lib/scorer";

function basePayload(overrides: Record<string, unknown> = {}) {
  return beaconPayloadSchema.parse({
    url: "https://example.com/",
    metadata: {
      title: "A solid example page title for SEO",
      description:
        "This meta description is long enough to score well and explain the page clearly to searchers.",
      canonical: "https://example.com/",
      ogTitle: "A solid example page title for SEO",
      ogDescription: "OG description",
      ogImage: "https://example.com/og.png",
      viewport: "width=device-width, initial-scale=1",
    },
    content: {
      wordCount: 420,
      headings: { h1: 1, h2: 2, h3: 0, h4: 0, h5: 0, h6: 0 },
      h1Texts: ["Example"],
      imagesCount: 2,
      imagesWithAlt: 2,
      linksCount: 5,
      internalLinksCount: 3,
      externalLinksCount: 2,
      questionCount: 0,
    },
    structure: {
      hasDoctype: true,
      hasHtmlLang: true,
      hasMain: true,
      headingOrder: true,
      domDepth: 8,
      semanticRatio: 20,
    },
    performance: {
      firstContentfulPaint: 1200,
      largestContentfulPaint: 2000,
      domContentLoaded: 1500,
      resourceCount: 20,
    },
    accessibility: {
      imagesWithoutAlt: 0,
      linksWithoutText: 0,
      inputsWithoutLabels: 0,
      hasSkipLink: true,
      hasLandmarkRegions: true,
    },
    aio: {
      hasStructuredData: false,
      structuredDataCount: 0,
      schemaTypes: [],
      hasFAQ: false,
      hasHowTo: false,
      hasClearDefinitions: false,
      questionCount: 0,
    },
    ...overrides,
  });
}

describe("AIO dimension weights", () => {
  it("pins the v0.2 prior table", () => {
    expect(RULE_WEIGHTS_VERSION).toBe("0.2.0");
    expect(AIO_DIMENSION_WEIGHTS).toEqual({
      crawl: 20,
      structure: 25,
      extractability: 25,
      entity: 15,
      consistency: 15,
    });
  });
});

describe("scoreAudit", () => {
  it("is deterministic for the same payload", () => {
    expect(scoreAudit(basePayload())).toEqual(scoreAudit(basePayload()));
  });

  it("returns every pillar plus an AIO breakdown", () => {
    const { scores } = scoreAudit(basePayload());
    for (const key of ["seo", "aio", "performance", "accessibility", "bestPractices", "overall"] as const) {
      expect(scores[key]).toBeGreaterThanOrEqual(0);
      expect(scores[key]).toBeLessThanOrEqual(100);
    }
    expect(Object.keys(scores.aioDimensions ?? {})).toEqual([
      "crawl",
      "structure",
      "extractability",
      "entity",
      "consistency",
    ]);
  });

  it("leaves the crawl dimension unknown when no crawl facts are supplied", () => {
    const { scores } = scoreAudit(basePayload());
    expect(scores.aioDimensions?.crawl.score).toBeNull();
  });

  it("rewards structured data, definitions, and question-shaped content", () => {
    const plain = scoreAudit(basePayload()).scores.aio;
    const rich = scoreAudit(
      basePayload({
        aio: {
          hasStructuredData: true,
          structuredDataCount: 2,
          schemaTypes: ["Organization", "FAQPage"],
          schemaNodes: [
            { type: "Organization", keys: ["name", "url", "sameAs"] },
            { type: "FAQPage", keys: ["mainEntity"] },
          ],
          hasFAQ: true,
          hasHowTo: false,
          hasClearDefinitions: true,
          questionCount: 4,
          avgSentenceLength: 17,
        },
        content: {
          ...basePayload().content,
          questionHeadingCount: 3,
          questionAnswerWords: [30, 45, 28],
          definitionSentenceCount: 2,
        },
      }),
    ).scores.aio;
    expect(rich).toBeGreaterThan(plain);
    expect(rich).toBeGreaterThanOrEqual(90);
  });

  it("flags missing title as critical SEO finding", () => {
    const { findings, scores } = scoreAudit(
      basePayload({
        metadata: {
          title: "",
          description: "desc",
          canonical: "",
          ogTitle: "",
          ogDescription: "",
          ogImage: "",
          viewport: "width=device-width",
          robots: "",
        },
      }),
    );

    const missing = findings.find((f) => f.ruleId === "seo.title.present");
    expect(missing?.title).toBe("Missing Page Title");
    expect(missing?.severity).toBe("critical");
    expect(scores.seo).toBeLessThan(80);
  });

  it("produces an overall average of the five category scores", () => {
    const { scores } = scoreAudit(basePayload());
    const expected = Math.round(
      (scores.seo +
        scores.aio +
        scores.performance +
        scores.accessibility +
        scores.bestPractices) /
        5,
    );
    expect(scores.overall).toBe(expected);
  });
});

describe("beaconPayloadSchema", () => {
  it("rejects invalid urls", () => {
    const result = beaconPayloadSchema.safeParse({ url: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("accepts a minimal valid payload", () => {
    const result = beaconPayloadSchema.safeParse({ url: "https://example.com/page" });
    expect(result.success).toBe(true);
  });

  it("accepts v0.2 fields and still rejects unknown keys", () => {
    expect(
      beaconPayloadSchema.safeParse({
        url: "https://example.com/page",
        packVersion: "0.2.0",
        content: { headingLevels: [1, 2, 2], questionAnswerWords: [40] },
        aio: { schemaNodes: [{ type: "Article", keys: ["headline"] }] },
      }).success,
    ).toBe(true);
    expect(beaconPayloadSchema.safeParse({ url: "https://example.com/page", content: { bodyHtml: "<p>" } }).success).toBe(false);
  });
});
