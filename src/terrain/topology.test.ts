import { describe, expect, it } from "vitest";
import { buildHuskGeometry } from "@/terrain/topology";

describe("buildHuskGeometry", () => {
  it("marks an isolated far point as shattered relative to a tight cluster", () => {
    const points = [
      { file: "a.ts", vector: [0.1, 0.1, 0.1] },
      { file: "b.ts", vector: [0.12, 0.11, 0.1] },
      { file: "c.ts", vector: [0.11, 0.1, 0.12] },
      { file: "outlier.ts", vector: [0.95, 0.9, 0.92] },
    ];

    const geometry = buildHuskGeometry(points);
    const outlier = geometry.files.find((f) => f.file === "outlier.ts");
    const cluster = geometry.files.find((f) => f.file === "a.ts");

    expect(outlier?.kind).toBe("shattered");
    expect(outlier?.shatter).toBeGreaterThan(cluster?.shatter ?? 0);
    expect(geometry.temporal).toBe(false);
    expect(geometry.dim).toBe(3);
    expect(outlier?.zone).toBe("cold");
    expect(cluster?.zone).not.toBe("cold");
  });

  it("uses the import graph so connected files run hotter than isolates", () => {
    const geometry = buildHuskGeometry(
      [
        { file: "src/a.ts", vector: [0.2, 0.2, 0.2] },
        { file: "src/b.ts", vector: [0.21, 0.2, 0.2] },
        { file: "src/lone.ts", vector: [0.22, 0.19, 0.21] },
      ],
      { edges: [["src/a.ts", "src/b.ts"]] },
    );
    const a = geometry.files.find((f) => f.file === "src/a.ts");
    const lone = geometry.files.find((f) => f.file === "src/lone.ts");
    expect(a?.heat).toBeGreaterThan(lone?.heat ?? 0);
  });

  it("does not invent lift percentages", () => {
    const geometry = buildHuskGeometry([
      { file: "a.ts", vector: [0.2, 0.2, 0.2] },
      { file: "b.ts", vector: [0.3, 0.2, 0.25] },
    ]);
    const blob = JSON.stringify(geometry);
    expect(blob).not.toMatch(/%|higher SEO|3x more|45%/);
  });
});
