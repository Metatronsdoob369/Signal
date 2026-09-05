/**
 * Proprietary — NODE OUT / Joe Wales. Not for distribution.
 * Ingest this repo as a husk, shatter-map it, write the map back into source.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { structuralFingerprint } from "./fingerprint";
import { buildImportEdges } from "./import-graph";
import { buildSlopCanon, type SlopCanon } from "./slop-canon";
import { buildHuskGeometry, type HuskGeometry } from "./topology";
import { walkSourceFiles } from "./walk";

export type DefenseMonitor = {
  watchFile: string;
  triggerOnShatter: number;
  status: "active";
};

export type DefensePatch = {
  canonicalFile: string;
  shatter: number;
  interpretation: string;
};

export type HuskWriteResult = {
  mapPath: string;
  geometry: HuskGeometry;
  slop: SlopCanon;
  defense: {
    monitors: DefenseMonitor[];
    patches: DefensePatch[];
  };
};

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeHuskMap(root: string): HuskWriteResult {
  const files = walkSourceFiles(root);
  const loaded = files.map((file) => {
    const source = readFileSync(join(root, file), "utf8");
    return { file, source, vector: structuralFingerprint(source) };
  });
  const edges = buildImportEdges(loaded);
  const geometry = buildHuskGeometry(loaded, { edges });
  const slop = buildSlopCanon(geometry);

  const map = {
    ...geometry,
    owner: "NODE OUT / Joe Wales",
    notice: "Proprietary husk. Not for distribution. Topology only — no temporal concat, no client DOM writes.",
    computedAt: new Date().toISOString(),
  };

  const mapPath = join(root, "terrain", "shatter-map.json");
  writeJson(mapPath, map);
  writeJson(join(root, "terrain", "slop-canon.json"), slop);
  writeFileSync(
    join(root, "terrain", "PROPRIETARY"),
    "Proprietary — NODE OUT / Joe Wales. Shatter map and defense artifacts are not for distribution.\n",
  );

  const shattered = geometry.files.filter((file) => file.kind === "shattered");
  const monitors: DefenseMonitor[] = [];
  const patches: DefensePatch[] = [];

  for (const file of shattered) {
    const monitor: DefenseMonitor = {
      watchFile: file.file,
      triggerOnShatter: file.shatter,
      status: "active",
    };
    const patch: DefensePatch = {
      canonicalFile: file.nearestCanonical ?? file.file,
      shatter: file.shatter,
      interpretation: `High shatter vs signal-husk centroid. Inspect ${file.file}; do not mutate client DOM.`,
    };
    monitors.push(monitor);
    patches.push(patch);
    const slug = file.file.replace(/[\\/]/g, "__");
    writeJson(join(root, "terrain", "defense", "monitors", `${slug}.monitor.json`), monitor);
    writeJson(join(root, "terrain", "defense", "patches", `${slug}.patch.json`), patch);
  }

  return { mapPath, geometry, slop, defense: { monitors, patches } };
}
