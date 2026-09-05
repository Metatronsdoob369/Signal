import { describe, expect, it } from "vitest";
import { buildImportEdges, parseImportSpecifiers } from "@/terrain/import-graph";

describe("parseImportSpecifiers", () => {
  it("reads relative and alias specifiers", () => {
    const source = `
      import { db } from "@/db";
      import { x } from "./alpha";
      export const y = 1;
    `;
    expect(parseImportSpecifiers(source)).toEqual(["@/db", "./alpha"]);
  });
});

describe("buildImportEdges", () => {
  it("connects a file to a resolved sibling, not to a missing module", () => {
    const edges = buildImportEdges([
      { file: "src/a.ts", source: 'import { b } from "./b";\n' },
      { file: "src/b.ts", source: "export const b = 1;\n" },
    ]);
    expect(edges).toEqual([["src/a.ts", "src/b.ts"]]);
  });
});
