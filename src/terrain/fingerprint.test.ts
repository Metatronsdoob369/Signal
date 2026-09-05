import { describe, expect, it } from "vitest";
import { structuralFingerprint } from "@/terrain/fingerprint";

describe("structuralFingerprint", () => {
  it("is deterministic for the same source", () => {
    const source = 'import { db } from "@/db";\nexport const x = 1;\n';
    expect(structuralFingerprint(source)).toEqual(structuralFingerprint(source));
  });

  it("uses three structural dims and never concatenates a time axis", () => {
    const v = structuralFingerprint("export const ok = true;\n");
    expect(v).toHaveLength(3);
  });

  it("changes when import structure changes", () => {
    const a = structuralFingerprint("export const a = 1;\n");
    const b = structuralFingerprint('import { z } from "zod";\nexport const a = 1;\n');
    expect(a[2]).toBeLessThan(b[2]);
  });
});
