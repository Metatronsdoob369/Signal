/**
 * Proprietary — NODE OUT / Joe Wales. Not for distribution.
 */

import { readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  "terrain",
  "drizzle",
]);

const EXTENSIONS = new Set([".ts", ".tsx"]);

export function walkSourceFiles(root: string): string[] {
  const files: string[] = [];

  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIRS.has(entry)) continue;
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      if (!EXTENSIONS.has(extname(entry))) continue;
      if (entry.endsWith(".d.ts")) continue;
      files.push(relative(root, full));
    }
  }

  walk(root);
  return files.sort();
}
