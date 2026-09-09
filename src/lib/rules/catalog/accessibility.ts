import { fail, na, pass, type Rule } from "../types";

const AUDIT = ["searchfit-seo:seo-audit", "searchfit-seo:technical-seo"] as const;

export const ACCESSIBILITY_RULES: readonly Rule[] = [
  {
    id: "a11y.images.alt",
    pillar: "accessibility",
    weight: 4,
    severity: "critical",
    title: "Images Missing Alt Text",
    provenance: AUDIT,
    evaluate: ({ payload, derived }) => {
      if (payload.content.imagesCount === 0 && payload.accessibility.imagesWithoutAlt === 0) return na();
      const missing = derived.imagesWithoutAlt;
      return missing === 0
        ? pass()
        : fail(`${missing} image${missing === 1 ? "" : "s"} lack alt attributes.`, "Add descriptive alt text; use alt=\"\" only for decoration.");
    },
  },
  {
    id: "a11y.links.text",
    pillar: "accessibility",
    weight: 3,
    severity: "warning",
    title: "Links Without Accessible Text",
    provenance: AUDIT,
    evaluate: ({ payload }) => {
      const count = payload.accessibility.linksWithoutText;
      return count === 0
        ? pass()
        : fail(`${count} link${count === 1 ? "" : "s"} have no accessible text.`, "Add text content or aria-label to every link.");
    },
  },
  {
    id: "a11y.buttons.text",
    pillar: "accessibility",
    weight: 2,
    severity: "warning",
    title: "Buttons Without Accessible Text",
    provenance: AUDIT,
    evaluate: ({ payload }) => {
      const count = payload.accessibility.buttonsWithoutText;
      return count === 0
        ? pass()
        : fail(`${count} button${count === 1 ? "" : "s"} have no accessible text.`, "Give icon buttons an aria-label.");
    },
  },
  {
    id: "a11y.inputs.labels",
    pillar: "accessibility",
    weight: 4,
    severity: "critical",
    title: "Form Inputs Without Labels",
    provenance: AUDIT,
    evaluate: ({ payload }) => {
      const count = payload.accessibility.inputsWithoutLabels;
      return count === 0
        ? pass()
        : fail(`${count} input${count === 1 ? "" : "s"} lack associated labels.`, "Add <label for> or aria-label to each input.");
    },
  },
  {
    id: "a11y.skip-link",
    pillar: "accessibility",
    weight: 1,
    severity: "info",
    title: "No Skip Link",
    provenance: AUDIT,
    evaluate: ({ payload }) =>
      payload.accessibility.hasSkipLink
        ? pass()
        : fail("Page lacks a skip-to-content link.", "Add a skip link as the first focusable element."),
  },
  {
    id: "a11y.landmarks",
    pillar: "accessibility",
    weight: 2,
    severity: "info",
    title: "Missing Landmark Regions",
    provenance: AUDIT,
    evaluate: ({ payload }) =>
      payload.accessibility.hasLandmarkRegions
        ? pass()
        : fail("Page lacks semantic landmark regions.", "Use main, nav, header, and footer elements."),
  },
  {
    id: "a11y.html-lang",
    pillar: "accessibility",
    weight: 2,
    severity: "warning",
    title: "Missing HTML Language",
    provenance: AUDIT,
    evaluate: ({ payload }) =>
      payload.structure.hasHtmlLang
        ? pass()
        : fail("The html element lacks a lang attribute, so screen readers guess the language.", 'Add lang="en" (or the correct language) to <html>.'),
  },
];
