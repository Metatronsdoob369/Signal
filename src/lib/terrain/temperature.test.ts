import { describe, expect, it } from "vitest";
import { HEAT_BANDS, classifyHeat, heatFromScore, temperatureHex, temperatureRgb } from "./temperature";

describe("temperature", () => {
  it("heat is the overall score as a share, clamped", () => {
    expect(heatFromScore(83)).toBeCloseTo(0.83, 9);
    expect(heatFromScore(0)).toBe(0);
    expect(heatFromScore(120)).toBe(1);
    expect(heatFromScore(-4)).toBe(0);
  });

  it("bands match the dashboard thresholds: hot at 80, warm at 60, cold below", () => {
    expect(HEAT_BANDS).toEqual({ hot: 0.8, warm: 0.6 });
    expect(classifyHeat(0.83)).toEqual({ zone: "hot", kind: "canonical", recommendation: "ANCHOR" });
    expect(classifyHeat(0.8)).toEqual({ zone: "hot", kind: "canonical", recommendation: "ANCHOR" });
    expect(classifyHeat(0.79)).toEqual({ zone: "warm", kind: "pending", recommendation: "REVIEW" });
    expect(classifyHeat(0.6)).toEqual({ zone: "warm", kind: "pending", recommendation: "REVIEW" });
    expect(classifyHeat(0.59)).toEqual({ zone: "cold", kind: "shattered", recommendation: "SHATTER_RESOLVE" });
    expect(classifyHeat(0)).toEqual({ zone: "cold", kind: "shattered", recommendation: "SHATTER_RESOLVE" });
  });

  it("gets warmer with heat: red over blue rises monotonically, hot end is copper, cold end is ash", () => {
    const samples = [0, 0.2, 0.4, 0.6, 0.8, 1];
    const warmth = samples.map((h) => {
      const [r, , b] = temperatureRgb(h);
      return r - b;
    });
    for (let i = 1; i < warmth.length; i++) expect(warmth[i]).toBeGreaterThan(warmth[i - 1]);
    const [r, g, b] = temperatureRgb(1);
    expect(r).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(b);
    const cold = temperatureRgb(0);
    expect(Math.max(...cold)).toBeLessThan(0.35);
  });

  it("never reaches green or a saturated blue", () => {
    for (let h = 0; h <= 1.0001; h += 0.05) {
      const [r, g, b] = temperatureRgb(h);
      expect(g).toBeLessThanOrEqual(Math.max(r, b) + 0.02);
      expect(b - r).toBeLessThan(0.12);
    }
  });

  it("formats hex and clamps", () => {
    expect(temperatureHex(0.83)).toMatch(/^#[0-9a-f]{6}$/);
    expect(temperatureHex(2)).toBe(temperatureHex(1));
    expect(temperatureHex(-1)).toBe(temperatureHex(0));
  });
});
