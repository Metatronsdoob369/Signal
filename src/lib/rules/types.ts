import type { AioDimension, BeaconPayload, CrawlFacts, Finding, SchemaNode } from "@/contracts";

export type Pillar = Finding["category"];
export type Severity = Finding["severity"];

/**
 * pass / fail count toward the pillar score.
 * na    — rule does not apply to this page (missing signal, wrong page type); excluded from the ratio.
 * info  — never scored; surfaces a finding the operator should read (policy notes, unknowns).
 */
export type RuleOutcome = "pass" | "fail" | "na" | "info";

export type RuleResult = {
  outcome: RuleOutcome;
  message?: string;
  fix?: string;
};

export type HeadingHierarchy = {
  valid: boolean;
  skips: number;
  startsAtH1: boolean;
};

export type UrlHygiene = {
  hasUppercase: boolean;
  hasUnderscore: boolean;
  depth: number;
  queryParams: number;
  issues: string[];
};

export type RobotsMeta = {
  directives: Set<string>;
  noindex: boolean;
  nosnippet: boolean;
  maxSnippetZero: boolean;
  noai: boolean;
};

export type SchemaSummary = {
  nodes: SchemaNode[];
  /** Lowercased @type names from nodes plus legacy schemaTypes. */
  types: Set<string>;
  known: number;
  complete: number;
  missing: Array<{ type: string; keys: string[] }>;
  entityNode: boolean;
  sameAs: boolean;
  hasDates: boolean;
  hasAuthor: boolean;
};

export type Derived = {
  isHttps: boolean;
  urlHygiene: UrlHygiene;
  headingHierarchy: HeadingHierarchy | null;
  titleH1Overlap: number | null;
  titleOgOverlap: number | null;
  descriptionOgOverlap: number | null;
  canonicalMatches: boolean | null;
  robotsMeta: RobotsMeta;
  schema: SchemaSummary;
  articleLike: boolean;
  imagesWithoutAlt: number;
  /** Share of question headings followed by a 15–80 word paragraph; null when no question headings. */
  answerFirstRatio: number | null;
  headingsPer300Words: number | null;
};

export type RuleContext = {
  payload: BeaconPayload;
  url: URL;
  crawl: CrawlFacts | null;
  derived: Derived;
};

export type Rule = {
  id: string;
  pillar: Pillar;
  dimension?: AioDimension;
  /** 0 marks an informational rule: it can emit a finding but never moves a score. */
  weight: number;
  severity: Severity;
  title: string;
  /** SearchFit skill ids whose checklist informed this rule. Audit trail for "derived, not copied". */
  provenance: readonly string[];
  evaluate: (ctx: RuleContext) => RuleResult;
};

export type RuleEvaluation = {
  rule: Rule;
  result: RuleResult;
};

export const pass = (): RuleResult => ({ outcome: "pass" });
export const na = (): RuleResult => ({ outcome: "na" });
export const fail = (message: string, fix?: string): RuleResult => ({
  outcome: "fail",
  message,
  fix,
});
export const info = (message: string, fix?: string): RuleResult => ({
  outcome: "info",
  message,
  fix,
});
