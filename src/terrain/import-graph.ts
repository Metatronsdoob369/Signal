/**
 * Proprietary — NODE OUT / Joe Wales. Not for distribution.
 * Import graph = the site's actual topology. Not a time axis.
 */

import { dirname, extname, join, normalize } from "node:path";

const IMPORT_RE = /(?:^|\n)\s*import\s+(?:type\s+)?(?:[^'"\n]+from\s+)?["']([^"']+)["']/g;

export function parseImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(IMPORT_RE)) {
    if (match[1]) specifiers.push(match[1]);
  }
  return specifiers;
}

function resolveSpecifier(fromFile: string, specifier: string, files: Set<string>): string | null {
  if (specifier.startsWith("@/")) {
    const withoutAlias = `src/${specifier.slice(2)}`;
    return matchFile(withoutAlias, files);
  }
  if (!specifier.startsWith(".")) return null;
  const base = normalize(join(dirname(fromFile), specifier));
  return matchFile(base, files);
}

function matchFile(base: string, files: Set<string>): string | null {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")];
  for (const candidate of candidates) {
    const normalized = candidate.replace(/\\/g, "/");
    if (files.has(normalized)) return normalized;
    if (extname(normalized) === "" && files.has(`${normalized}.ts`)) return `${normalized}.ts`;
  }
  return files.has(base) ? base : null;
}

export function buildImportEdges(files: Array<{ file: string; source: string }>): Array<[string, string]> {
  const known = new Set(files.map((file) => file.file.replace(/\\/g, "/")));
  const edges: Array<[string, string]> = [];
  for (const file of files) {
    const from = file.file.replace(/\\/g, "/");
    for (const specifier of parseImportSpecifiers(file.source)) {
      const to = resolveSpecifier(from, specifier, known);
      if (to && to !== from) edges.push([from, to]);
    }
  }
  return edges;
}
