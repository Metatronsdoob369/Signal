import { fail, na, pass, type Rule } from "../types";

const TECHNICAL = ["searchfit-seo:technical-seo", "searchfit-seo:seo-audit"] as const;

export const BEST_PRACTICE_RULES: readonly Rule[] = [
  {
    id: "bp.doctype",
    pillar: "best-practices",
    weight: 3,
    severity: "critical",
    title: "Missing DOCTYPE",
    provenance: TECHNICAL,
    evaluate: ({ payload }) =>
      payload.structure.hasDoctype
        ? pass()
        : fail("Page lacks a DOCTYPE declaration and renders in quirks mode.", "Add <!DOCTYPE html> as the first line."),
  },
  {
    id: "bp.viewport",
    pillar: "best-practices",
    weight: 4,
    severity: "critical",
    title: "Missing Viewport Meta",
    provenance: TECHNICAL,
    evaluate: ({ payload }) =>
      payload.metadata.viewport
        ? pass()
        : fail("No viewport meta tag; the page is not mobile-friendly.", 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.'),
  },
  {
    id: "bp.https",
    pillar: "best-practices",
    weight: 4,
    severity: "critical",
    title: "Page Served Over HTTP",
    provenance: TECHNICAL,
    evaluate: ({ url, derived }) => {
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return na();
      return derived.isHttps ? pass() : fail("The page loaded over plain HTTP.", "Serve over HTTPS and redirect HTTP to HTTPS.");
    },
  },
  {
    id: "bp.mixed-content",
    pillar: "best-practices",
    weight: 3,
    severity: "warning",
    title: "Mixed Content",
    provenance: TECHNICAL,
    evaluate: ({ payload, derived }) => {
      if (!derived.isHttps) return na();
      const count = payload.structure.mixedContentCount;
      return count === 0
        ? pass()
        : fail(`${count} resource${count === 1 ? "" : "s"} loaded over http: on an https: page.`, "Update resource URLs to https.");
    },
  },
  {
    id: "bp.main-landmark",
    pillar: "best-practices",
    weight: 1,
    severity: "info",
    title: "No main Element",
    provenance: TECHNICAL,
    evaluate: ({ payload }) =>
      payload.structure.hasMain ? pass() : fail("The page has no <main> element.", "Wrap the primary content in <main>."),
  },
  {
    id: "bp.dom-depth",
    pillar: "best-practices",
    weight: 1,
    severity: "info",
    title: "Deep DOM",
    provenance: TECHNICAL,
    evaluate: ({ payload }) => {
      const depth = payload.structure.domDepth;
      if (!depth) return na();
      return depth < 32 ? pass() : fail(`DOM nesting reaches ${depth} levels.`, "Flatten wrapper elements.");
    },
  },
  {
    id: "bp.semantic-ratio",
    pillar: "best-practices",
    weight: 1,
    severity: "info",
    title: "Low Semantic Markup",
    provenance: TECHNICAL,
    evaluate: ({ payload }) => {
      const ratio = payload.structure.semanticRatio;
      return ratio >= 3
        ? pass()
        : fail(`Semantic elements make up ${ratio}% of the DOM.`, "Prefer section, article, nav, and header over generic div wrappers.");
    },
  },
];
