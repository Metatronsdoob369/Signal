/**
 * Proprietary — NODE OUT / Joe Wales. Not for distribution.
 * Topological husk geometry: k-NN graph, Laplacian heat, shatter from centroid.
 * Static source — no [t-1|t|t+1] concat.
 */

import { HUSK_DIM } from "./fingerprint";

export type HuskKind = "canonical" | "pending" | "shattered";
export type HuskRecommendation = "ANCHOR" | "REVIEW" | "SHATTER_RESOLVE" | "SLOP_CHECK";
export type HuskZone = "hot" | "warm" | "cold";

export type HuskFile = {
  file: string;
  shatter: number;
  heat: number;
  kind: HuskKind;
  zone: HuskZone;
  recommendation: HuskRecommendation;
  nearestCanonical: string | null;
};

export type HuskGeometry = {
  domain: "signal-husk";
  geometry: "topological";
  temporal: false;
  dim: typeof HUSK_DIM;
  proprietary: true;
  centroid: [number, number, number];
  files: HuskFile[];
};

type InputPoint = { file: string; vector: number[] };

export type GeometryOptions = {
  edges?: Array<[string, string]>;
};

function distance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function meanVector(points: InputPoint[]): [number, number, number] {
  const acc = [0, 0, 0];
  for (const point of points) {
    acc[0] += point.vector[0] ?? 0;
    acc[1] += point.vector[1] ?? 0;
    acc[2] += point.vector[2] ?? 0;
  }
  const n = Math.max(points.length, 1);
  return [acc[0] / n, acc[1] / n, acc[2] / n];
}

function knnHeat(points: InputPoint[], k: number): number[] {
  const heat = points.map(() => 0);
  if (points.length < 2) return heat;
  const neighbors = Math.min(k, points.length - 1);

  for (let i = 0; i < points.length; i++) {
    const ranked = points
      .map((other, j) => ({ j, d: i === j ? Number.POSITIVE_INFINITY : distance(points[i].vector, other.vector) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, neighbors);
    heat[i] = ranked.reduce((sum, edge) => sum + Math.exp(-edge.d * edge.d), 0);
  }
  return heat;
}

function importGraphHeat(points: InputPoint[], edges: Array<[string, string]>): number[] {
  const index = new Map(points.map((point, i) => [point.file, i]));
  const neighbors: number[][] = points.map(() => []);
  for (const [from, to] of edges) {
    const i = index.get(from);
    const j = index.get(to);
    if (i === undefined || j === undefined || i === j) continue;
    neighbors[i].push(j);
    neighbors[j].push(i);
  }

  return points.map((point, i) => {
    const ids = neighbors[i] ?? [];
    if (ids.length === 0) return 0;
    const scores = ids.map((j) => Math.exp(-distance(point.vector, points[j]?.vector ?? point.vector)));
    const denom = scores.reduce((sum, value) => sum + value, 0) || 1;
    return scores.reduce((sum, value) => sum + value / denom, 0);
  });
}

function classify(
  shatter: number,
  mean: number,
  std: number,
): { kind: HuskKind; zone: HuskZone; recommendation: HuskRecommendation } {
  if (shatter >= mean + 0.5 * std) {
    return { kind: "shattered", zone: "cold", recommendation: "SLOP_CHECK" };
  }
  if (shatter <= mean - 0.25 * std) {
    return { kind: "canonical", zone: "hot", recommendation: "ANCHOR" };
  }
  return { kind: "pending", zone: "warm", recommendation: "REVIEW" };
}

export function buildHuskGeometry(points: InputPoint[], options: GeometryOptions = {}): HuskGeometry {
  if (points.length === 0) {
    return {
      domain: "signal-husk",
      geometry: "topological",
      temporal: false,
      dim: HUSK_DIM,
      proprietary: true,
      centroid: [0, 0, 0],
      files: [],
    };
  }

  const centroid = meanVector(points);
  const shatterScores = points.map((point) => distance(point.vector, centroid));
  const mean = shatterScores.reduce((sum, value) => sum + value, 0) / shatterScores.length;
  const variance =
    shatterScores.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(shatterScores.length, 1);
  const std = Math.sqrt(variance);
  const heat = options.edges?.length ? importGraphHeat(points, options.edges) : knnHeat(points, 3);

  const files: HuskFile[] = points.map((point, index) => {
    const shatter = shatterScores[index] ?? 0;
    const { kind, zone, recommendation } = classify(shatter, mean, std || 1);
    return {
      file: point.file,
      shatter,
      heat: heat[index] ?? 0,
      kind,
      zone,
      recommendation,
      nearestCanonical: null,
    };
  });

  const canonical = files.filter((file) => file.kind === "canonical");
  for (const file of files) {
    if (file.kind === "canonical" || canonical.length === 0) continue;
    const self = points.find((point) => point.file === file.file);
    if (!self) continue;
    let best: { file: string; d: number } | null = null;
    for (const candidate of canonical) {
      const other = points.find((point) => point.file === candidate.file);
      if (!other) continue;
      const d = distance(self.vector, other.vector);
      if (!best || d < best.d) best = { file: candidate.file, d };
    }
    file.nearestCanonical = best?.file ?? null;
  }

  return {
    domain: "signal-husk",
    geometry: "topological",
    temporal: false,
    dim: HUSK_DIM,
    proprietary: true,
    centroid,
    files,
  };
}
