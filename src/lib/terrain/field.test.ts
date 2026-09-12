import { describe, expect, it } from "vitest";
import { buildTerrain, type TerrainAudit } from "./build";
import { contourPaths, sampleField } from "./field";

const lander: TerrainAudit = {
  url: "https://cosineautonomous.com/",
  overallScore: "83.00",
  seoScore: "80.00",
  aioScore: "57.00",
  createdAt: new Date("2026-09-11T22:38:19.184Z"),
  wordCount: 1135,
  structuredDataCount: 0,
  hasClearDefinitions: true,
  questionCount: 0,
  payload: null,
};

describe("sampleField", () => {
  it("is all zero for empty ground", () => {
    const field = sampleField(buildTerrain([], "x.com"), { cols: 4, rows: 4 });
    expect(field.heights).toHaveLength(25);
    expect(Array.from(field.heights).every((h) => h === 0)).toBe(true);
    expect(field.maxHeight).toBe(0);
  });

  it("puts one hill at the centre with the page's substance as its peak and its heat as its colour", () => {
    const terrain = buildTerrain([lander], "cosineautonomous.com");
    const field = sampleField(terrain, { cols: 8, rows: 8 });
    const centre = 4 * 9 + 4;
    expect(field.heights[centre]).toBeCloseTo(terrain.points[0].substance, 6);
    expect(field.maxHeight).toBeCloseTo(terrain.points[0].substance, 6);
    expect(field.heats[centre]).toBeCloseTo(0.83, 6);
    for (let j = 0; j <= 8; j++) {
      for (let i = 0; i <= 8; i++) {
        expect(field.heights[j * 9 + i]).toBeCloseTo(field.heights[(8 - j) * 9 + (8 - i)], 9);
      }
    }
    expect(field.heights[0]).toBeLessThan(field.heights[centre]);
  });

  it("colours the void cold", () => {
    const field = sampleField(buildTerrain([lander], "x.com"), { cols: 8, rows: 8 });
    expect(field.heats[0]).toBeLessThan(1e-6);
  });
});

describe("contourPaths", () => {
  it("draws nothing on flat ground", () => {
    const field = sampleField(buildTerrain([], "x.com"), { cols: 8, rows: 8 });
    const paths = contourPaths(field, { levels: 6, width: 400, height: 400 });
    expect(paths).toHaveLength(6);
    expect(paths.every((p) => p === "")).toBe(true);
  });

  it("draws closed rings around one hill, deterministically", () => {
    const field = sampleField(buildTerrain([lander], "x.com"), { cols: 24, rows: 24 });
    const paths = contourPaths(field, { levels: 6, width: 400, height: 400 });
    expect(paths.filter((p) => p.length > 0).length).toBeGreaterThanOrEqual(4);
    expect(paths[0]).toMatch(/^M[\d.]+ [\d.]+L[\d.]+ [\d.]+/);
    expect(contourPaths(field, { levels: 6, width: 400, height: 400 })).toEqual(paths);
  });
});

describe("contourSegments and heightAt", () => {
  it("segments back the paths one for one and heights interpolate to the grid", async () => {
    const { contourSegments, heightAt } = await import("./field");
    const field = sampleField(buildTerrain([lander], "x.com"), { cols: 24, rows: 24 });
    const segments = contourSegments(field, 6);
    const paths = contourPaths(field, { levels: 6, width: 240, height: 240 });
    segments.forEach((level, li) => {
      expect((paths[li].match(/M/g) ?? []).length).toBe(level.length);
    });
    expect(heightAt(field, 12, 12)).toBeCloseTo(field.heights[12 * 25 + 12], 9);
    expect(heightAt(field, 0, 0)).toBeCloseTo(field.heights[0], 9);
    const mid = heightAt(field, 12.5, 12);
    expect(mid).toBeGreaterThan(Math.min(field.heights[12 * 25 + 12], field.heights[12 * 25 + 13]) - 1e-9);
    expect(mid).toBeLessThan(Math.max(field.heights[12 * 25 + 12], field.heights[12 * 25 + 13]) + 1e-9);
  });
});
