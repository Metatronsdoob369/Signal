import { describe, expect, it } from "vitest";
import {
  answerFirstRatio,
  canonicalMatches,
  headingHierarchy,
  parseRobotsMeta,
  summarizeSchema,
  tokenOverlap,
  urlHygiene,
} from "@/lib/rules/derive";

describe("tokenOverlap", () => {
  it("ignores stopwords, case, and punctuation", () => {
    expect(tokenOverlap("The Best Coffee Roaster in Birmingham", "best coffee roaster, birmingham!")).toBe(1);
  });

  it("is zero when either side is empty or all stopwords", () => {
    expect(tokenOverlap("", "anything")).toBe(0);
    expect(tokenOverlap("the and of", "anything")).toBe(0);
  });

  it("measures against the smaller set", () => {
    expect(tokenOverlap("Signal", "Signal audits pages deterministically")).toBe(1);
    expect(tokenOverlap("apples oranges", "apples pears")).toBe(0.5);
  });
});

describe("headingHierarchy", () => {
  it("returns null with no headings", () => {
    expect(headingHierarchy([])).toBeNull();
  });

  it("accepts a clean outline", () => {
    expect(headingHierarchy([1, 2, 3, 3, 2, 3])).toEqual({ valid: true, skips: 0, startsAtH1: true });
  });

  it("counts skipped levels and a non-H1 start", () => {
    expect(headingHierarchy([2, 4, 2])).toEqual({ valid: false, skips: 1, startsAtH1: false });
  });

  it("allows jumping back up any number of levels", () => {
    expect(headingHierarchy([1, 2, 3, 4, 1])?.valid).toBe(true);
  });
});

describe("urlHygiene", () => {
  it("flags uppercase, underscores, depth, and parameter soup", () => {
    const result = urlHygiene(new URL("https://x.com/A/b_c/d/e/f?utm_a=1&utm_b=2&utm_c=3"));
    expect(result.hasUppercase).toBe(true);
    expect(result.hasUnderscore).toBe(true);
    expect(result.depth).toBe(5);
    expect(result.queryParams).toBe(3);
    expect(result.issues).toHaveLength(4);
  });

  it("passes a clean path", () => {
    expect(urlHygiene(new URL("https://x.com/blog/signal-v02")).issues).toEqual([]);
  });
});

describe("parseRobotsMeta", () => {
  it("reads noindex, nosnippet, max-snippet:0 and noai", () => {
    const meta = parseRobotsMeta("noindex, NoSnippet , max-snippet:0,noai");
    expect(meta.noindex).toBe(true);
    expect(meta.nosnippet).toBe(true);
    expect(meta.maxSnippetZero).toBe(true);
    expect(meta.noai).toBe(true);
  });

  it("treats none as noindex and index,follow as open", () => {
    expect(parseRobotsMeta("none").noindex).toBe(true);
    const open = parseRobotsMeta("index, follow");
    expect(open.noindex).toBe(false);
    expect(open.nosnippet).toBe(false);
  });
});

describe("canonicalMatches", () => {
  const page = new URL("https://www.example.com/blog/post/?utm=1#top");

  it("returns null when there is no canonical", () => {
    expect(canonicalMatches(page, "")).toBeNull();
  });

  it("ignores www, trailing slash, query and hash", () => {
    expect(canonicalMatches(page, "https://example.com/blog/post")).toBe(true);
  });

  it("resolves relative canonicals", () => {
    expect(canonicalMatches(page, "/blog/post")).toBe(true);
  });

  it("rejects a canonical to another page or host", () => {
    expect(canonicalMatches(page, "https://example.com/blog/")).toBe(false);
    expect(canonicalMatches(page, "https://other.com/blog/post")).toBe(false);
    expect(canonicalMatches(page, "not a url ::")).toBe(false);
  });
});

describe("summarizeSchema", () => {
  it("checks required keys per type and detects entity signals", () => {
    const summary = summarizeSchema(
      [
        { type: "Organization", keys: ["name", "url", "logo", "sameAs"] },
        { type: "Article", keys: ["headline", "author"] },
        { type: "FAQPage", keys: ["mainEntity"] },
        { type: "Thing", keys: ["name"] },
      ],
      [],
    );
    expect(summary.known).toBe(3);
    expect(summary.complete).toBe(2);
    expect(summary.missing).toEqual([{ type: "Article", keys: ["datePublished"] }]);
    expect(summary.entityNode).toBe(true);
    expect(summary.sameAs).toBe(true);
    expect(summary.hasAuthor).toBe(true);
    expect(summary.hasDates).toBe(false);
    expect(summary.types.has("thing")).toBe(true);
  });

  it("accepts alternatives separated by |", () => {
    const summary = summarizeSchema([{ type: "Product", keys: ["name", "offers"] }], []);
    expect(summary.complete).toBe(1);
  });

  it("falls back to legacy type names when a v0.1 pack sends no nodes", () => {
    const summary = summarizeSchema([], ["Organization", "WebPage"]);
    expect(summary.known).toBe(0);
    expect(summary.entityNode).toBe(true);
    expect(summary.types.has("webpage")).toBe(true);
  });
});

describe("answerFirstRatio", () => {
  it("is null without question headings", () => {
    expect(answerFirstRatio([])).toBeNull();
  });

  it("counts only 15–80 word answers", () => {
    expect(answerFirstRatio([40, 0, 200, 15, 80, 81])).toBe(0.5);
  });
});
