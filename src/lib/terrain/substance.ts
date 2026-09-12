import { z } from "zod";

/**
 * Substance is the terrain's elevation: how much evidence a page gives a model to work with.
 * Deterministic, from counts the pack already ships. Weights and saturation points are v0 priors.
 */
export type SubstanceEvidence = {
  wordCount: number;
  structuredDataCount: number;
  definitionSentenceCount: number;
  listCount: number;
  tableCount: number;
  questionHeadingCount: number;
  hasSummaryBlock: boolean;
  h2Count: number;
  h3Count: number;
};

export const SUBSTANCE_WEIGHTS = {
  words: 0.3,
  structuredData: 0.2,
  definitions: 0.15,
  listsTables: 0.1,
  questionHeadings: 0.1,
  summaryBlock: 0.1,
  headingDepth: 0.05,
} as const;

/** The count at which each signal stops adding elevation. */
export const SUBSTANCE_SATURATION = {
  words: 1500,
  structuredData: 3,
  definitions: 5,
  listsTables: 8,
  questionHeadings: 4,
  headingDepth: 12,
} as const;

function saturate(count: number, at: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return Math.min(1, count / at);
}

export function emptyEvidence(): SubstanceEvidence {
  return {
    wordCount: 0,
    structuredDataCount: 0,
    definitionSentenceCount: 0,
    listCount: 0,
    tableCount: 0,
    questionHeadingCount: 0,
    hasSummaryBlock: false,
    h2Count: 0,
    h3Count: 0,
  };
}

export function substance(evidence: SubstanceEvidence): number {
  const w = SUBSTANCE_WEIGHTS;
  const s = SUBSTANCE_SATURATION;
  return (
    w.words * saturate(evidence.wordCount, s.words) +
    w.structuredData * saturate(evidence.structuredDataCount, s.structuredData) +
    w.definitions * saturate(evidence.definitionSentenceCount, s.definitions) +
    w.listsTables * saturate(evidence.listCount + 2 * evidence.tableCount, s.listsTables) +
    w.questionHeadings * saturate(evidence.questionHeadingCount, s.questionHeadings) +
    w.summaryBlock * (evidence.hasSummaryBlock ? 1 : 0) +
    w.headingDepth * saturate(evidence.h2Count + evidence.h3Count, s.headingDepth)
  );
}

const count = z.number().int().nonnegative();

const payloadEvidenceSchema = z.object({
  content: z
    .object({
      wordCount: count.optional(),
      listCount: count.optional(),
      tableCount: count.optional(),
      definitionSentenceCount: count.optional(),
      questionHeadingCount: count.optional(),
      hasSummaryBlock: z.boolean().optional(),
      headings: z.object({ h2: count.optional(), h3: count.optional() }).optional(),
    })
    .optional(),
  aio: z.object({ structuredDataCount: count.optional() }).optional(),
});

export type EvidenceAudit = {
  wordCount: number;
  structuredDataCount: number;
  hasClearDefinitions: boolean;
  questionCount: number;
  payload: unknown;
};

/** Evidence from the stored v0.2 payload when present, otherwise from the audit's own columns. */
export function evidenceFromAudit(audit: EvidenceAudit): SubstanceEvidence {
  const fromColumns: SubstanceEvidence = {
    ...emptyEvidence(),
    wordCount: audit.wordCount,
    structuredDataCount: audit.structuredDataCount,
    definitionSentenceCount: audit.hasClearDefinitions ? 1 : 0,
    questionHeadingCount: audit.questionCount,
  };
  const parsed = payloadEvidenceSchema.safeParse(audit.payload);
  if (!parsed.success) return fromColumns;
  const content = parsed.data.content;
  const aio = parsed.data.aio;
  if (!content && !aio) return fromColumns;
  return {
    wordCount: content?.wordCount ?? fromColumns.wordCount,
    structuredDataCount: aio?.structuredDataCount ?? fromColumns.structuredDataCount,
    definitionSentenceCount: content?.definitionSentenceCount ?? fromColumns.definitionSentenceCount,
    listCount: content?.listCount ?? 0,
    tableCount: content?.tableCount ?? 0,
    questionHeadingCount: content?.questionHeadingCount ?? fromColumns.questionHeadingCount,
    hasSummaryBlock: content?.hasSummaryBlock ?? false,
    h2Count: content?.headings?.h2 ?? 0,
    h3Count: content?.headings?.h3 ?? 0,
  };
}
