import { describe, expect, it } from "vitest";
import { buildSlopCanon } from "@/terrain/slop-canon";
import { buildHuskGeometry } from "@/terrain/topology";

describe("buildSlopCanon", () => {
  it("maps cold failure regions instead of prescribing success", () => {
    const geometry = buildHuskGeometry([
      { file: "src/ok.ts", vector: [0.1, 0.1, 0.1] },
      { file: "src/ok2.ts", vector: [0.12, 0.11, 0.1] },
      { file: "src/cold.ts", vector: [0.95, 0.9, 0.92] },
    ]);

    const slop = buildSlopCanon(geometry);
    expect(slop.principle).toMatch(/avoid|failure|cold/i);
    expect(slop.cold.some((entry) => entry.file === "src/cold.ts")).toBe(true);
    expect(JSON.stringify(slop)).not.toMatch(/higher SEO|3x more|do this correctly|best practice recipe/i);
  });

  it("includes hard-no patterns as permanent avoid memory", () => {
    const slop = buildSlopCanon(buildHuskGeometry([{ file: "a.ts", vector: [0, 0, 0] }]));
    const patterns = slop.cold.map((entry) => entry.badPattern);
    expect(patterns.some((pattern) => pattern.includes("innerHTML"))).toBe(true);
    expect(patterns.some((pattern) => /lift|peer average/i.test(pattern))).toBe(true);
  });
});
