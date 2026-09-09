import { describe, expect, it } from "vitest";
import { beaconPayloadSchema, crawlFactsSchema, type CrawlFacts } from "@/contracts";
import { KNOWN_BOTS } from "@/lib/crawl/bots";
import { parseBeaconPayload } from "@/lib/payload-guard";
import { RULES, evaluateRules, ruleById } from "@/lib/rules/engine";
import { AIO_DIMENSION_WEIGHTS } from "@/lib/rules/weights";

function crawlFacts(overrides: Partial<Record<string, "allow" | "disallow" | "unspecified">> = {}, extra: Partial<CrawlFacts["robots"]> = {}, llms: CrawlFacts["llmsTxt"]["status"] = "ok"): CrawlFacts {
  const bots: Record<string, "allow" | "disallow" | "unspecified"> = {};
  for (const bot of KNOWN_BOTS) bots[bot.token] = overrides[bot.token] ?? "allow";
  return crawlFactsSchema.parse({
    fetchedAt: "2026-09-09T00:00:00.000Z",
    domain: "example.com",
    robots: { status: "ok", sitemapDeclared: true, disallowAll: false, bots, ...extra },
    llmsTxt: { status: llms },
  });
}

const strongPage = beaconPayloadSchema.parse({
  url: "https://example.com/guides/signal-audits",
  packVersion: "0.2.0",
  metadata: {
    title: "Signal Audits: How the Embed Scores a Page",
    description:
      "Signal audits a page on load, scores SEO and AI readiness deterministically, and shows the result on a token-scoped dashboard you own.",
    canonical: "https://example.com/guides/signal-audits",
    ogTitle: "Signal Audits: How the Embed Scores a Page",
    ogDescription:
      "Signal audits a page on load, scores SEO and AI readiness deterministically, and shows the result on a token-scoped dashboard you own.",
    ogImage: "https://example.com/og/signal.png",
    ogUrl: "https://example.com/guides/signal-audits",
    twitterCard: "summary_large_image",
    viewport: "width=device-width, initial-scale=1",
    robots: "index, follow",
    author: "Joe Wales",
    publishedTime: "2026-09-01T00:00:00Z",
    modifiedTime: "2026-09-09T00:00:00Z",
  },
  content: {
    wordCount: 1400,
    headings: { h1: 1, h2: 4, h3: 3, h4: 0, h5: 0, h6: 0 },
    h1Texts: ["How the Signal embed scores a page"],
    headingLevels: [1, 2, 3, 3, 2, 2, 3, 2],
    emptyHeadingCount: 0,
    questionHeadingCount: 3,
    questionAnswerWords: [42, 55, 38],
    hasSummaryBlock: true,
    paragraphCount: 18,
    avgParagraphWords: 70,
    listCount: 3,
    tableCount: 1,
    sentenceCount: 90,
    definitionSentenceCount: 3,
    imagesCount: 4,
    imagesWithAlt: 4,
    imagesWithDimensions: 4,
    imagesLazy: 2,
    linksCount: 14,
    internalLinksCount: 9,
    externalLinksCount: 5,
    genericAnchorCount: 0,
    questionCount: 6,
    timeElementCount: 2,
    hasByline: true,
  },
  structure: {
    hasDoctype: true,
    hasHtmlLang: true,
    hasMain: true,
    headingOrder: true,
    domDepth: 14,
    semanticRatio: 9,
    headScriptsBlocking: 0,
    thirdPartyScriptCount: 2,
    mixedContentCount: 0,
  },
  performance: {
    timeToFirstByte: 220,
    firstContentfulPaint: 900,
    largestContentfulPaint: 1600,
    domContentLoaded: 1100,
    cumulativeLayoutShift: 0.02,
    interactionToNextPaint: 80,
    resourceCount: 28,
    transferBytes: 900_000,
  },
  accessibility: {
    imagesWithoutAlt: 0,
    linksWithoutText: 0,
    buttonsWithoutText: 0,
    inputsWithoutLabels: 0,
    hasSkipLink: true,
    hasLandmarkRegions: true,
  },
  aio: {
    hasStructuredData: true,
    structuredDataCount: 3,
    schemaTypes: ["Organization", "Article", "FAQPage"],
    schemaNodes: [
      { type: "Organization", keys: ["name", "url", "logo", "sameAs"] },
      { type: "Article", keys: ["headline", "author", "datePublished", "dateModified"] },
      { type: "FAQPage", keys: ["mainEntity"] },
    ],
    schemaParseErrors: 0,
    hasFAQ: true,
    hasHowTo: false,
    hasClearDefinitions: true,
    questionCount: 6,
    avgSentenceLength: 16,
  },
});

const weakPage = beaconPayloadSchema.parse({
  url: "http://example.com/Blog_Posts/x?a=1&b=2&c=3",
  metadata: { robots: "noindex, nosnippet" },
  content: { wordCount: 120, headings: { h1: 0, h2: 0, h3: 0, h4: 0, h5: 0, h6: 0 } },
  structure: { hasDoctype: false, hasHtmlLang: false, hasMain: false, headingOrder: true, domDepth: 40, semanticRatio: 0 },
  accessibility: { imagesWithoutAlt: 3, linksWithoutText: 2, inputsWithoutLabels: 1, hasSkipLink: false, hasLandmarkRegions: false },
});

/** Exactly what a v0.1 pack sends: no v0.2 fields at all. */
const legacyPage = beaconPayloadSchema.parse({
  url: "https://legacy.example.com/",
  metadata: {
    title: "A solid example page title for SEO",
    description: "This meta description is long enough to score well and explain the page clearly to searchers.",
    canonical: "https://legacy.example.com/",
    ogTitle: "A solid example page title for SEO",
    ogDescription: "OG description",
    ogImage: "https://legacy.example.com/og.png",
    viewport: "width=device-width, initial-scale=1",
    robots: "",
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
  structure: { hasDoctype: true, hasHtmlLang: true, hasMain: true, headingOrder: true, domDepth: 8, semanticRatio: 20 },
  performance: { firstContentfulPaint: 1200, largestContentfulPaint: 2000, domContentLoaded: 1500, resourceCount: 20 },
  accessibility: { imagesWithoutAlt: 0, linksWithoutText: 0, inputsWithoutLabels: 0, hasSkipLink: true, hasLandmarkRegions: true },
  aio: { hasStructuredData: false, structuredDataCount: 0, schemaTypes: [], hasFAQ: false, hasHowTo: false, hasClearDefinitions: false, questionCount: 0 },
});

describe("rule catalog", () => {
  it("has unique ids, non-negative weights, and provenance on every rule", () => {
    const ids = new Set<string>();
    for (const rule of RULES) {
      expect(ids.has(rule.id)).toBe(false);
      ids.add(rule.id);
      expect(rule.weight).toBeGreaterThanOrEqual(0);
      expect(rule.provenance.length).toBeGreaterThan(0);
      for (const source of rule.provenance) expect(source).toMatch(/^searchfit-seo:/);
      if (rule.pillar === "aio") expect(rule.dimension).toBeDefined();
      else expect(rule.dimension).toBeUndefined();
    }
    expect(RULES.length).toBeGreaterThanOrEqual(50);
  });

  it("weights every AIO dimension", () => {
    expect(Object.values(AIO_DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe("evaluateRules", () => {
  it("is deterministic", () => {
    const facts = crawlFacts();
    const a = evaluateRules(strongPage, facts);
    const b = evaluateRules(strongPage, facts);
    expect(a.scores).toEqual(b.scores);
    expect(a.findings).toEqual(b.findings);
  });

  it("scores a well-built page high across every AIO dimension", () => {
    const { scores, findings } = evaluateRules(strongPage, crawlFacts());
    expect(scores.aio).toBeGreaterThanOrEqual(90);
    expect(scores.seo).toBeGreaterThanOrEqual(90);
    for (const dimension of Object.values(scores.aioDimensions ?? {})) {
      expect(dimension.score).not.toBeNull();
      expect(dimension.score ?? 0).toBeGreaterThanOrEqual(80);
    }
    expect(findings.filter((f) => f.severity === "critical")).toEqual([]);
  });

  it("scores a broken page low and names the blocking rules", () => {
    const facts = crawlFacts({ "OAI-SearchBot": "disallow", PerplexityBot: "disallow", GPTBot: "disallow", CCBot: "disallow" });
    const { scores, findings } = evaluateRules(weakPage, facts);
    expect(scores.aio).toBeLessThan(40);
    expect(scores.seo).toBeLessThan(40);
    const ids = findings.map((f) => f.ruleId);
    expect(ids).toContain("aio.crawl.retrieval-bots");
    expect(ids).toContain("aio.schema.present");
    expect(ids).toContain("aio.crawl.snippets");
    expect(ids).toContain("seo.robots.indexable");
    expect(ids).toContain("seo.url.clean");
    expect(ids).toContain("bp.https");
    const retrieval = findings.find((f) => f.ruleId === "aio.crawl.retrieval-bots");
    expect(retrieval?.severity).toBe("critical");
    expect(retrieval?.message).toContain("OAI-SearchBot");
    expect(retrieval?.message).not.toContain("GPTBot");
  });

  it("reports training opt-outs as information, never as a scored failure", () => {
    const blockedTrainers = crawlFacts({ GPTBot: "disallow", CCBot: "disallow", "Google-Extended": "disallow" });
    const open = crawlFacts();
    const withOptOut = evaluateRules(strongPage, blockedTrainers);
    const without = evaluateRules(strongPage, open);
    expect(withOptOut.scores.aio).toBe(without.scores.aio);
    const note = withOptOut.findings.find((f) => f.ruleId === "aio.crawl.training-policy");
    expect(note?.severity).toBe("info");
    expect(note?.message).toContain("GPTBot");
    expect(without.findings.some((f) => f.ruleId === "aio.crawl.training-policy")).toBe(false);
  });

  it("marks the crawl dimension unknown when robots.txt has not been read", () => {
    const { scores, findings } = evaluateRules(strongPage, null);
    expect(scores.aioDimensions?.crawl.score).toBeNull();
    expect(findings.some((f) => f.ruleId === "aio.crawl.facts-unknown")).toBe(true);
    const known = evaluateRules(strongPage, crawlFacts()).scores;
    expect(known.aioDimensions?.crawl.score).not.toBeNull();
  });

  it("treats a failed robots fetch like an unknown, not like an open site", () => {
    const errored = crawlFacts({}, { status: "error" });
    const { scores } = evaluateRules(strongPage, errored);
    expect(scores.aioDimensions?.crawl.score).toBeNull();
  });

  it("handles a v0.1 payload without v0.2 fields", () => {
    const report = evaluateRules(legacyPage, null);
    expect(report.scores.overall).toBeGreaterThan(0);
    expect(report.scores.aioDimensions?.consistency.score).toBe(100);
    expect(report.findings.every((f) => typeof f.ruleId === "string")).toBe(true);
    const hierarchy = report.evaluations.find((e) => e.rule.id === "seo.headings.hierarchy");
    expect(hierarchy?.result.outcome).toBe("na");
  });

  it("computes overall as the mean of the five pillars", () => {
    const { scores } = evaluateRules(strongPage, crawlFacts());
    const expected = Math.round(
      (scores.seo + scores.aio + scores.performance + scores.accessibility + scores.bestPractices) / 5,
    );
    expect(scores.overall).toBe(expected);
  });

  it("orders findings critical, warning, info", () => {
    const { findings } = evaluateRules(weakPage, crawlFacts({ PerplexityBot: "disallow" }));
    const order = { critical: 0, warning: 1, info: 2 } as const;
    for (let i = 1; i < findings.length; i += 1) {
      expect(order[findings[i].severity]).toBeGreaterThanOrEqual(order[findings[i - 1].severity]);
    }
  });

  it("scores schema completeness from property names only", () => {
    const partial = beaconPayloadSchema.parse({
      ...strongPage,
      aio: {
        ...strongPage.aio,
        schemaNodes: [
          { type: "Organization", keys: ["name"] },
          { type: "Article", keys: ["headline"] },
        ],
      },
    });
    const { findings } = evaluateRules(partial, crawlFacts());
    const completeness = findings.find((f) => f.ruleId === "aio.schema.completeness");
    expect(completeness?.message).toContain("Organization: url");
    expect(completeness?.message).toContain("Article: author, datePublished");
  });

  it("fails answer-first when question sections bury the answer", () => {
    const buried = beaconPayloadSchema.parse({
      ...strongPage,
      content: { ...strongPage.content, questionAnswerWords: [0, 240, 300] },
    });
    const { findings } = evaluateRules(buried, crawlFacts());
    expect(findings.some((f) => f.ruleId === "aio.answer.answer-first")).toBe(true);
  });

  it("fixture payloads pass the ingest guard, not only the schema", () => {
    for (const payload of [strongPage, weakPage, legacyPage]) {
      const guarded = parseBeaconPayload(JSON.parse(JSON.stringify(payload)));
      expect(guarded.ok).toBe(true);
    }
  });

  it("exposes rules by id", () => {
    expect(ruleById("aio.crawl.retrieval-bots")?.dimension).toBe("crawl");
    expect(ruleById("nope")).toBeUndefined();
  });
});
