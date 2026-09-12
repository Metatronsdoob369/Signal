import type { Terrain } from "./build";

export type Field = {
  cols: number;
  rows: number;
  /** Half-width of the sampled square in terrain units; the unit disk sits inside it. */
  extent: number;
  /** (cols + 1) * (rows + 1) samples, row-major, j * (cols + 1) + i. */
  heights: Float32Array;
  heats: Float32Array;
  maxHeight: number;
};

export type FieldOptions = { cols: number; rows: number; sigma?: number; extent?: number };

/**
 * Elevation is the sum of Gaussian hills, one per page, peaking at its substance.
 * Heat is the kernel-weighted mean of page heat; it cools to zero in the void between hills.
 */
export function sampleField(terrain: Terrain, options: FieldOptions): Field {
  const { cols, rows } = options;
  const sigma = options.sigma ?? 0.22;
  const extent = options.extent ?? 1.25;
  const stride = cols + 1;
  const heights = new Float32Array(stride * (rows + 1));
  const heats = new Float32Array(stride * (rows + 1));
  const twoSigmaSq = 2 * sigma * sigma;
  let maxHeight = 0;

  for (let j = 0; j <= rows; j++) {
    const z = -extent + (2 * extent * j) / rows;
    for (let i = 0; i <= cols; i++) {
      const x = -extent + (2 * extent * i) / cols;
      let height = 0;
      let weight = 0;
      let heat = 0;
      for (const point of terrain.points) {
        const dx = x - point.position[0];
        const dz = z - point.position[2];
        const w = Math.exp(-(dx * dx + dz * dz) / twoSigmaSq);
        height += point.substance * w;
        weight += w;
        heat += point.heat * w;
      }
      const index = j * stride + i;
      heights[index] = height;
      heats[index] = weight > 0 ? heat / Math.max(weight, 1) : 0;
      if (height > maxHeight) maxHeight = height;
    }
  }

  return { cols, rows, extent, heights, heats, maxHeight };
}

export type ContourOptions = { levels: number; width: number; height: number };

/** A contour segment in grid units: x in [0, cols], y in [0, rows]. */
export type Segment = [number, number, number, number];

function lerp(x1: number, y1: number, v1: number, x2: number, y2: number, v2: number, t: number): [number, number] {
  const k = (t - v1) / (v2 - v1 || 1e-9);
  return [x1 + (x2 - x1) * k, y1 + (y2 - y1) * k];
}

/** Level thresholds: evenly spaced through (0, maxHeight]. */
export function contourLevels(field: Field, levels: number): number[] {
  return Array.from({ length: levels }, (_, li) => (field.maxHeight * (li + 0.5)) / levels);
}

/** Marching squares over the field, one segment list per level, in grid units. */
export function contourSegments(field: Field, levels: number): Segment[][] {
  const { cols, rows, heights, maxHeight } = field;
  const stride = cols + 1;
  const out: Segment[][] = [];

  for (const t of contourLevels(field, levels)) {
    const segments: Segment[] = [];
    if (maxHeight > 0) {
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const tl = heights[j * stride + i];
          const tr = heights[j * stride + i + 1];
          const br = heights[(j + 1) * stride + i + 1];
          const bl = heights[(j + 1) * stride + i];
          const bits = (tl > t ? 8 : 0) | (tr > t ? 4 : 0) | (br > t ? 2 : 0) | (bl > t ? 1 : 0);
          if (bits === 0 || bits === 15) continue;

          const top = () => lerp(i, j, tl, i + 1, j, tr, t);
          const right = () => lerp(i + 1, j, tr, i + 1, j + 1, br, t);
          const bottom = () => lerp(i, j + 1, bl, i + 1, j + 1, br, t);
          const left = () => lerp(i, j, tl, i, j + 1, bl, t);
          const seg = (a: [number, number], b: [number, number]) => segments.push([a[0], a[1], b[0], b[1]]);

          switch (bits) {
            case 1:
            case 14:
              seg(left(), bottom());
              break;
            case 2:
            case 13:
              seg(bottom(), right());
              break;
            case 3:
            case 12:
              seg(left(), right());
              break;
            case 4:
            case 11:
              seg(top(), right());
              break;
            case 6:
            case 9:
              seg(top(), bottom());
              break;
            case 7:
            case 8:
              seg(top(), left());
              break;
            case 5:
              seg(top(), left());
              seg(bottom(), right());
              break;
            case 10:
              seg(top(), right());
              seg(bottom(), left());
              break;
          }
        }
      }
    }
    out.push(segments);
  }
  return out;
}

const r1 = (n: number) => n.toFixed(1);

/** One SVG path per level, scaled to width x height; empty when the level is never crossed. */
export function contourPaths(field: Field, options: ContourOptions): string[] {
  const sx = options.width / field.cols;
  const sy = options.height / field.rows;
  return contourSegments(field, options.levels).map((segments) =>
    segments.map(([x1, y1, x2, y2]) => `M${r1(x1 * sx)} ${r1(y1 * sy)}L${r1(x2 * sx)} ${r1(y2 * sy)}`).join(""),
  );
}

/** Bilinear height at grid coordinates. */
export function heightAt(field: Field, gx: number, gy: number): number {
  const stride = field.cols + 1;
  const x = Math.min(Math.max(gx, 0), field.cols);
  const y = Math.min(Math.max(gy, 0), field.rows);
  const i0 = Math.min(Math.floor(x), field.cols - 1);
  const j0 = Math.min(Math.floor(y), field.rows - 1);
  const fx = x - i0;
  const fy = y - j0;
  const h = field.heights;
  const a = h[j0 * stride + i0];
  const b = h[j0 * stride + i0 + 1];
  const c = h[(j0 + 1) * stride + i0];
  const d = h[(j0 + 1) * stride + i0 + 1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}
