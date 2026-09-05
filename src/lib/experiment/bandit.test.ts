import { describe, expect, it } from "vitest";
import { pickVariant } from "./bandit";

describe("pickVariant", () => {
  it("returns null for an empty pool", () => {
    expect(pickVariant([])).toBeNull();
  });

  it("returns the only row without sampling", () => {
    const only = { id: "a", impressions: 0, successes: 0 };
    expect(pickVariant([only])).toEqual(only);
  });

  it("picks the row with the highest sample", () => {
    const low = { id: "low", impressions: 10, successes: 1 };
    const high = { id: "high", impressions: 10, successes: 8 };
    const picked = pickVariant([low, high], (alpha, beta) => alpha / (alpha + beta));
    expect(picked?.id).toBe("high");
  });
});
