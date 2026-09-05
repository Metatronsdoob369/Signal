/**
 * Proprietary — NODE OUT / Joe Wales. Not for distribution.
 * bun src/terrain/write-husk.ts
 */

import { writeHuskMap } from "./husk";

const root = process.cwd();
const result = writeHuskMap(root);
const shattered = result.geometry.files.filter((file) => file.kind === "shattered").length;
console.log(`signal-husk map → ${result.mapPath}`);
console.log(
  `files=${result.geometry.files.length} shattered=${shattered} cold=${result.slop.cold.length} monitors=${result.defense.monitors.length}`,
);
