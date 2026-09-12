import { describe, expect, it } from "vitest";
import { buildTerrain, latestPerPath, pagePath, spiralPositions, type TerrainAudit } from "./build";

function audit(overrides: Partial<TerrainAudit> & { url: string }): TerrainAudit {
  return {
    overallScore: "83.00",
    seoScore: "80.00",
    aioScore: "57.00",
    createdAt: new Date("2026-09-11T22:38:19.184Z"),
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
    ...overrides,
  };
}

describe("pagePath", () => {
  it("normalizes to a path without query, hash, or trailing slash", () => {
    expect(pagePath("https://cosineautonomous.com/")).toBe("/");
    expect(pagePath("https://x.com/a/b/?q=1#h")).toBe("/a/b");
    expect(pagePath("https://x.com/A/B")).toBe("/A/B");
    expect(pagePath("not a url")).toBeNull();
  });
});

describe("latestPerPath", () => {
  it("keeps the newest audit for each path from a newest-first list", () => {
    const newest = audit({ url: "https://x.com/", overallScore: "83.00" });
    const older = audit({ url: "https://x.com/?utm=1", overallScore: "82.00" });
    const pricing = audit({ url: "https://x.com/pricing/", overallScore: "40.00" });
    const kept = latestPerPath([newest, older, pricing]);
    expect(kept.map((entry) => entry.path)).toEqual(["/", "/pricing"]);
    expect(kept[0].audit).toBe(newest);
  });

  it("drops audits whose URL does not parse", () => {
    expect(latestPerPath([audit({ url: "nope" })])).toEqual([]);
  });
});

describe("spiralPositions", () => {
  it("puts a single point at the origin", () => {
    expect(spiralPositions(1)).toEqual([[0, 0, 0]]);
  });

  it("is deterministic, starts at the origin, and stays inside the unit disk", () => {
    const a = spiralPositions(7);
    const b = spiralPositions(7);
    expect(a).toEqual(b);
    expect(a[0]).toEqual([0, 0, 0]);
    for (const [x, y, z] of a) {
      expect(y).toBe(0);
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(1 + 1e-9);
    }
    const keys = new Set(a.map((p) => p.map((v) => v.toFixed(6)).join(",")));
    expect(keys.size).toBe(7);
  });
});

describe("buildTerrain", () => {
  it("returns empty ground for a site with no audits", () => {
    const terrain = buildTerrain([], "cosineautonomous.com");
    expect(terrain.points).toEqual([]);
    expect(terrain.singular).toBe(false);
    expect(terrain.domain).toBe("cosineautonomous.com");
    expect(terrain.geometry).toBe("signal-terrain");
  });

  it("makes the lander one hot hill", () => {
    const terrain = buildTerrain([audit({ url: "https://cosineautonomous.com/" })], "cosineautonomous.com");
    expect(terrain.singular).toBe(true);
    expect(terrain.points).toHaveLength(1);
    const point = terrain.points[0];
    expect(point.path).toBe("/");
    expect(point.heat).toBeCloseTo(0.83, 9);
    expect(point.shatter).toBeCloseTo(0.17, 9);
    expect(point.zone).toBe("hot");
    expect(point.kind).toBe("canonical");
    expect(point.recommendation).toBe("ANCHOR");
    expect(point.substance).toBeCloseTo(0.407, 3);
    expect(point.attention).toBeNull();
    expect(point.position).toEqual([0, 0, 0]);
    expect(point.nearestCanonical).toBeNull();
    expect(point.scores).toEqual({ overall: 83, seo: 80, aio: 57 });
    expect(point.auditedAt).toBe("2026-09-11T22:38:19.184Z");
  });

  it("points cold pages at the hot page most like them", () => {
    const home = audit({ url: "https://x.com/", overallScore: "83.00" });
    const about = audit({ url: "https://x.com/about", overallScore: "88.00", wordCount: 300, payload: null });
    const pricing = audit({ url: "https://x.com/pricing", overallScore: "40.00", wordCount: 320, payload: null });
    const terrain = buildTerrain([home, about, pricing], "x.com");
    const byPath = Object.fromEntries(terrain.points.map((p) => [p.path, p]));
    expect(byPath["/pricing"].zone).toBe("cold");
    expect(byPath["/pricing"].nearestCanonical).toBe("/about");
    expect(byPath["/"].nearestCanonical).toBeNull();
    expect(byPath["/about"].nearestCanonical).toBeNull();
    expect(terrain.singular).toBe(false);
    expect(terrain.points.map((p) => p.path)).toEqual(["/", "/about", "/pricing"]);
  });

  it("has no canonical to point at when every page is cold", () => {
    const terrain = buildTerrain(
      [audit({ url: "https://x.com/", overallScore: "40.00" }), audit({ url: "https://x.com/b", overallScore: "30.00" })],
      "x.com",
    );
    for (const point of terrain.points) expect(point.nearestCanonical).toBeNull();
  });
});
