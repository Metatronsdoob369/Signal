import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { writeHuskMap } from "@/terrain/husk";

describe("writeHuskMap", () => {
  it("writes a shatter map back into source without embedding file bodies", () => {
    const root = mkdtempSync(join(tmpdir(), "signal-husk-"));
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src", "alpha.ts"), "export const a = 1;\n");
    writeFileSync(
      join(root, "src", "beta.ts"),
      'import { a } from "./alpha";\nimport { z } from "zod";\nexport const b = a;\n',
    );

    const result = writeHuskMap(root);
    const mapPath = join(root, "terrain", "shatter-map.json");
    const map = JSON.parse(readFileSync(mapPath, "utf8")) as {
      proprietary: boolean;
      temporal: boolean;
      files: Array<{ file: string; source?: string }>;
    };

    expect(result.mapPath).toBe(mapPath);
    expect(map.proprietary).toBe(true);
    expect(map.temporal).toBe(false);
    expect(map.files.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(map)).not.toContain("export const a = 1");
    expect(map.files.every((f) => f.source === undefined)).toBe(true);
  });

  it("writes a slop-canon of cold areas so navigation avoids failure", () => {
    const root = mkdtempSync(join(tmpdir(), "signal-husk-slop-"));
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src", "a.ts"), "export const a = 1;\n");
    writeFileSync(join(root, "src", "b.ts"), "export const b = 2;\n");
    writeFileSync(
      join(root, "src", "cold.ts"),
      `${"import { x } from 'x';\n".repeat(40)}export const cold = 1;\n`,
    );

    const result = writeHuskMap(root);
    const slop = JSON.parse(readFileSync(join(root, "terrain", "slop-canon.json"), "utf8")) as {
      cold: Array<{ zone: string }>;
    };
    expect(result.slop.cold.length).toBeGreaterThan(0);
    expect(slop.cold.every((entry) => entry.zone === "cold")).toBe(true);
  });

  it("writes defense monitors only for shattered files, never DOM auto-fixes", () => {
    const root = mkdtempSync(join(tmpdir(), "signal-husk-def-"));
    mkdirSync(join(root, "src"));
    writeFileSync(join(root, "src", "a.ts"), "export const a = 1;\n");
    writeFileSync(join(root, "src", "b.ts"), "export const b = 2;\n");
    writeFileSync(
      join(root, "src", "weird.ts"),
      `${"import { x } from 'x';\n".repeat(40)}export const weird = 1;\n`,
    );

    const result = writeHuskMap(root);
    const monitors = result.defense.monitors;
    const blob = JSON.stringify(result.defense);
    expect(blob).not.toContain("innerHTML");
    expect(blob).not.toContain("add-meta");
    expect(monitors.every((m) => m.watchFile.length > 0)).toBe(true);
  });
});
