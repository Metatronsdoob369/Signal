import type { AioDimension } from "@/contracts";

/**
 * v0.2 priors. These weights encode a judgment about what matters for a page to be
 * retrievable and quotable by AI systems; they are not measured outcomes and the
 * product never presents them as such. Revisit when real client pages have run.
 */
export const RULE_WEIGHTS_VERSION = "0.2.0";

export const AIO_DIMENSION_WEIGHTS: Readonly<Record<AioDimension, number>> = {
  crawl: 20,
  structure: 25,
  extractability: 25,
  entity: 15,
  consistency: 15,
};

export const AIO_DIMENSION_LABELS: Readonly<Record<AioDimension, string>> = {
  crawl: "AI crawler access",
  structure: "Structured data",
  extractability: "Answer readiness",
  entity: "Entity and provenance",
  consistency: "Signal consistency",
};
