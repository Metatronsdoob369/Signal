import { describe, expect, it } from "vitest";
import { beaconPayloadSchema } from "@/contracts";
import { AIO_WEIGHTS, scoreAudit } from "@/lib/scorer";

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

describe("AIO weights", () => {
  it("pins the v2 weight table", () => {
    expect(AIO_WEIGHTS).toEqual({
      base: 50,
      structuredData: 15,
      faq: 10,
      howTo: 10,
      definitions: 10,
      questions: 5,
    });
  });
});

describe("scoreAudit", () => {
  it("starts AIO at base 50 with no AIO signals", () => {
    const { scores } = scoreAudit(basePayload());
    expect(scores.aio).toBe(50);
  });

  it("adds structured data, FAQ, HowTo, definitions, and questions", () => {
    const { scores } = scoreAudit(
      basePayload({
        aio: {
          hasStructuredData: true,
          structuredDataCount: 1,
          schemaTypes: ["FAQPage", "HowTo"],
          hasFAQ: true,
          hasHowTo: true,
          hasClearDefinitions: true,
          questionCount: 4,
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
          questionCount: 4,
        },
      }),
    );

    expect(scores.aio).toBe(100);
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

    expect(findings.some((f) => f.title === "Missing Page Title" && f.severity === "critical")).toBe(
      true,
    );
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
});
