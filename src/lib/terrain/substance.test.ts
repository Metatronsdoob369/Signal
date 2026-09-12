import { describe, expect, it } from "vitest";
import { SUBSTANCE_WEIGHTS, emptyEvidence, evidenceFromAudit, substance } from "./substance";

// The lander's real audit on 2026-09-11: 1135 words, 13 lists, 1 definition sentence, 2 h2 + 16 h3,
// no structured data, no summary block, no question headings.
const lander = {
  wordCount: 1135,
  structuredDataCount: 0,
  definitionSentenceCount: 1,
  listCount: 13,
  tableCount: 0,
  questionHeadingCount: 0,
  hasSummaryBlock: false,
  h2Count: 2,
  h3Count: 16,
};

describe("substance", () => {
  it("weights sum to one", () => {
    const total = Object.values(SUBSTANCE_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(total).toBeCloseTo(1, 9);
  });

  it("is zero with no evidence and one when every signal saturates", () => {
    expect(substance(emptyEvidence())).toBe(0);
    expect(
      substance({
        wordCount: 5000,
        structuredDataCount: 6,
        definitionSentenceCount: 12,
        listCount: 20,
        tableCount: 4,
        questionHeadingCount: 9,
        hasSummaryBlock: true,
        h2Count: 10,
        h3Count: 30,
      }),
    ).toBeCloseTo(1, 9);
  });

  it("scores the lander at 0.407 under the v0 priors", () => {
    expect(substance(lander)).toBeCloseTo(0.407, 3);
  });

  it("is monotonic in each signal", () => {
    const more = substance({ ...lander, structuredDataCount: 2 });
    expect(more).toBeGreaterThan(substance(lander));
    const summary = substance({ ...lander, hasSummaryBlock: true });
    expect(summary).toBeCloseTo(substance(lander) + SUBSTANCE_WEIGHTS.summaryBlock, 9);
  });

  it("reads evidence from a v0.2 payload", () => {
    const evidence = evidenceFromAudit({
      wordCount: 1135,
      structuredDataCount: 0,
      hasClearDefinitions: true,
      questionCount: 0,
      payload: {
        content: {
          wordCount: 1135,
          listCount: 13,
          tableCount: 0,
          definitionSentenceCount: 1,
          questionHeadingCount: 0,
          hasSummaryBlock: false,
          headings: { h1: 1, h2: 2, h3: 16, h4: 3, h5: 0, h6: 0 },
        },
        aio: { structuredDataCount: 0 },
      },
    });
    expect(evidence).toEqual(lander);
  });

  it("falls back to the audit columns when the payload is missing", () => {
    const evidence = evidenceFromAudit({
      wordCount: 400,
      structuredDataCount: 1,
      hasClearDefinitions: true,
      questionCount: 3,
      payload: null,
    });
    expect(evidence).toEqual({
      ...emptyEvidence(),
      wordCount: 400,
      structuredDataCount: 1,
      definitionSentenceCount: 1,
      questionHeadingCount: 3,
    });
  });
});
