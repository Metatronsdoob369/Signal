import { describe, expect, it } from "vitest";
import { choosePromotion, chooseRetirement, heuristicMutants } from "./optimizer";

const longDesc =
  "Need a plumber tonight? We cover Springfield 24/7 with licensed techs and same-hour arrival windows.";

describe("choosePromotion", () => {
  it("does not promote before 30 impressions", () => {
    expect(
      choosePromotion([
        { id: "def", isDefault: true, active: true, impressions: 29, successes: 10 },
        { id: "win", isDefault: false, active: true, impressions: 29, successes: 20 },
      ]),
    ).toBeNull();
  });

  it("promotes a challenger that beats the default by 15% after 30 impressions", () => {
    const decision = choosePromotion([
      { id: "def", isDefault: true, active: true, impressions: 30, successes: 10 },
      { id: "win", isDefault: false, active: true, impressions: 30, successes: 20 },
    ]);
    expect(decision).toEqual({ promoteId: "win" });
  });

  it("does not promote a challenger under the 15% bar", () => {
    expect(
      choosePromotion([
        { id: "def", isDefault: true, active: true, impressions: 30, successes: 20 },
        { id: "near", isDefault: false, active: true, impressions: 30, successes: 21 },
      ]),
    ).toBeNull();
  });
});

describe("chooseRetirement", () => {
  it("retires the worst non-default when over capacity", () => {
    const rows = [
      { id: "def", isDefault: true, active: true, impressions: 40, successes: 20 },
      { id: "ok", isDefault: false, active: true, impressions: 40, successes: 18 },
      { id: "bad", isDefault: false, active: true, impressions: 40, successes: 2 },
      { id: "mid", isDefault: false, active: true, impressions: 40, successes: 12 },
      { id: "mid2", isDefault: false, active: true, impressions: 40, successes: 11 },
      { id: "extra", isDefault: false, active: true, impressions: 40, successes: 10 },
    ];
    expect(chooseRetirement(rows)).toEqual({ retireId: "bad" });
  });
});

describe("heuristicMutants", () => {
  it("returns title/description pairs that pass constraints", () => {
    const mutants = heuristicMutants({
      title: "Emergency plumber in Springfield",
      description: longDesc,
    });
    expect(mutants.length).toBeGreaterThan(0);
    for (const mutant of mutants) {
      expect(mutant.title.length).toBeGreaterThanOrEqual(30);
      expect(mutant.title.length).toBeLessThanOrEqual(60);
      expect(mutant.description.length).toBeGreaterThanOrEqual(100);
      expect(mutant.description.length).toBeLessThanOrEqual(160);
    }
  });

  it("does not emit the incumbent pair", () => {
    const title = "Emergency plumber in Springfield";
    const mutants = heuristicMutants({ title, description: longDesc });
    expect(mutants.some((m) => m.title === title && m.description === longDesc)).toBe(false);
  });
});
