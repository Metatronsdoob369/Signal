import { describe, expect, it } from "vitest";
import { terrainDashboardEnabled } from "./flag";

describe("terrainDashboardEnabled", () => {
  it("is on only for the exact value 1", () => {
    expect(terrainDashboardEnabled({ TERRAIN_DASHBOARD: "1" })).toBe(true);
    expect(terrainDashboardEnabled({ TERRAIN_DASHBOARD: "true" })).toBe(false);
    expect(terrainDashboardEnabled({ TERRAIN_DASHBOARD: "0" })).toBe(false);
    expect(terrainDashboardEnabled({})).toBe(false);
  });
});
