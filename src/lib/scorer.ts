import type { BeaconPayload, CrawlFacts, Finding, Scores } from "@/contracts";
import { evaluateRules } from "@/lib/rules/engine";

export { AIO_DIMENSION_WEIGHTS, RULE_WEIGHTS_VERSION } from "@/lib/rules/weights";

export type ScoreOptions = {
  /** Site-level robots.txt / llms.txt facts. Null excludes the crawl dimension rather than guessing. */
  crawl?: CrawlFacts | null;
};

/**
 * Deterministic: same payload and same crawl facts always produce the same scores and
 * findings. No model, no network, no tenant state.
 */
export function scoreAudit(
  payload: BeaconPayload,
  options: ScoreOptions = {},
): { scores: Scores; findings: Finding[] } {
  const { scores, findings } = evaluateRules(payload, options.crawl ?? null);
  return { scores, findings };
}
