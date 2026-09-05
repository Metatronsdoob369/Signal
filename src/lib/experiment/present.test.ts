import { describe, expect, it } from "vitest";
import { engagementRate, impressionsUntilDecision, presentExperimentRows } from "./present";

describe("engagementRate", () => {
  it("returns 0 when there are no impressions", () => {
    expect(engagementRate(0, 4)).toBe(0);
  });

  it("divides successes by impressions", () => {
    expect(engagementRate(20, 5)).toBe(0.25);
  });
});

describe("impressionsUntilDecision", () => {
  it("returns remaining impressions before a promote decision", () => {
    expect(impressionsUntilDecision(12)).toBe(18);
    expect(impressionsUntilDecision(30)).toBe(0);
  });
});

describe("presentExperimentRows", () => {
  it("marks the default and never invents a lift claim", () => {
    const rows = presentExperimentRows([
      {
        id: "a",
        title: "Home",
        description: "Welcome.",
        isDefault: true,
        source: "seed",
        impressions: 8,
        successes: 2,
      },
      {
        id: "b",
        title: "Home guide",
        description: "Welcome today.",
        isDefault: false,
        source: "heuristic",
        impressions: 4,
        successes: 1,
      },
    ]);
    expect(rows[0]?.isDefault).toBe(true);
    expect(rows[0]?.needsImpressions).toBe(22);
    expect(JSON.stringify(rows)).not.toMatch(/lift/i);
  });
});
