import {
  AIO_DIMENSIONS,
  type AioDimension,
  type AioDimensionScore,
  type BeaconPayload,
  type CrawlFacts,
  type Finding,
  type Scores,
} from "@/contracts";
import { ACCESSIBILITY_RULES } from "./catalog/accessibility";
import { AIO_RULES } from "./catalog/aio";
import { BEST_PRACTICE_RULES } from "./catalog/best-practices";
import { PERFORMANCE_RULES } from "./catalog/performance";
import { SEO_RULES } from "./catalog/seo";
import { deriveContext } from "./derive";
import type { Pillar, Rule, RuleEvaluation, Severity } from "./types";
import { AIO_DIMENSION_WEIGHTS } from "./weights";

export const RULES: readonly Rule[] = [
  ...SEO_RULES,
  ...AIO_RULES,
  ...PERFORMANCE_RULES,
  ...ACCESSIBILITY_RULES,
  ...BEST_PRACTICE_RULES,
];

const RULE_INDEX = new Map(RULES.map((rule) => [rule.id, rule] as const));

export function ruleById(id: string): Rule | undefined {
  return RULE_INDEX.get(id);
}

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
const NEUTRAL = 50;

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Weighted share of applicable rules that passed; null when nothing applied. */
function weightedRatio(evaluations: readonly RuleEvaluation[]): { score: number | null; applicable: number; passed: number } {
  let weightTotal = 0;
  let weightPassed = 0;
  let applicable = 0;
  let passed = 0;
  for (const { rule, result } of evaluations) {
    if (rule.weight <= 0) continue;
    if (result.outcome !== "pass" && result.outcome !== "fail") continue;
    applicable += 1;
    weightTotal += rule.weight;
    if (result.outcome === "pass") {
      passed += 1;
      weightPassed += rule.weight;
    }
  }
  return { score: weightTotal ? (weightPassed / weightTotal) * 100 : null, applicable, passed };
}

function pillarScore(evaluations: readonly RuleEvaluation[], pillar: Pillar): number {
  const ratio = weightedRatio(evaluations.filter((e) => e.rule.pillar === pillar));
  return ratio.score === null ? NEUTRAL : clamp(ratio.score);
}

/**
 * The crawl dimension is site-level. Without a successful robots.txt read it is reported
 * as unknown and excluded from the weighting, so page-level rules in that dimension
 * cannot masquerade as a verdict on crawler access.
 */
function aioScore(
  evaluations: readonly RuleEvaluation[],
  crawlKnown: boolean,
): {
  score: number;
  dimensions: Record<AioDimension, AioDimensionScore>;
} {
  const dimensions = {} as Record<AioDimension, AioDimensionScore>;
  let weightTotal = 0;
  let weighted = 0;
  for (const dimension of AIO_DIMENSIONS) {
    const ratio = weightedRatio(
      evaluations.filter((e) => e.rule.pillar === "aio" && e.rule.dimension === dimension),
    );
    if (dimension === "crawl" && !crawlKnown) ratio.score = null;
    dimensions[dimension] = {
      score: ratio.score === null ? null : clamp(ratio.score),
      applicable: ratio.applicable,
      passed: ratio.passed,
    };
    if (ratio.score !== null) {
      weightTotal += AIO_DIMENSION_WEIGHTS[dimension];
      weighted += AIO_DIMENSION_WEIGHTS[dimension] * ratio.score;
    }
  }
  return { score: weightTotal ? clamp(weighted / weightTotal) : NEUTRAL, dimensions };
}

function toFinding({ rule, result }: RuleEvaluation): Finding | null {
  if (result.outcome !== "fail" && result.outcome !== "info") return null;
  return {
    category: rule.pillar,
    severity: result.outcome === "info" ? "info" : rule.severity,
    title: rule.title,
    message: result.message ?? rule.title,
    fix: result.fix,
    ruleId: rule.id,
    dimension: rule.dimension,
  };
}

export type EvaluationReport = {
  scores: Scores;
  findings: Finding[];
  evaluations: RuleEvaluation[];
};

export function evaluateRules(payload: BeaconPayload, crawl: CrawlFacts | null = null): EvaluationReport {
  const ctx = deriveContext(payload, crawl);
  const evaluations: RuleEvaluation[] = RULES.map((rule) => ({ rule, result: rule.evaluate(ctx) }));

  const crawlKnown = crawl !== null && crawl.robots.status !== "error";
  const aio = aioScore(evaluations, crawlKnown);
  const seo = pillarScore(evaluations, "seo");
  const performance = pillarScore(evaluations, "performance");
  const accessibility = pillarScore(evaluations, "accessibility");
  const bestPractices = pillarScore(evaluations, "best-practices");

  const scores: Scores = {
    seo,
    aio: aio.score,
    performance,
    accessibility,
    bestPractices,
    overall: clamp((seo + aio.score + performance + accessibility + bestPractices) / 5),
    aioDimensions: aio.dimensions,
  };

  const findings = evaluations
    .map(toFinding)
    .filter((finding): finding is Finding => finding !== null)
    .sort((a, b) => {
      const severity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (severity !== 0) return severity;
      const weightA = a.ruleId ? (RULE_INDEX.get(a.ruleId)?.weight ?? 0) : 0;
      const weightB = b.ruleId ? (RULE_INDEX.get(b.ruleId)?.weight ?? 0) : 0;
      if (weightA !== weightB) return weightB - weightA;
      return (a.ruleId ?? "").localeCompare(b.ruleId ?? "");
    });

  return { scores, findings, evaluations };
}
