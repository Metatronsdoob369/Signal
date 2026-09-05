/**
 * Proprietary — NODE OUT / Joe Wales. Not for distribution.
 * 0-dim structural fingerprint. No Ollama. No cloud. No time axis.
 */

import { createHash } from "node:crypto";

export const HUSK_DIM = 3 as const;

export function countImports(source: string): number {
  const matches = source.match(/^\s*import\s/gm);
  return matches?.length ?? 0;
}

export function structuralFingerprint(source: string): [number, number, number] {
  const bytes = Buffer.byteLength(source, "utf8");
  const sha = createHash("sha256").update(source).digest("hex");
  const hashNorm = Number.parseInt(sha.slice(0, 8), 16) / 0xffffffff;
  return [Math.log1p(bytes), hashNorm, Math.log1p(countImports(source))];
}
