import { evidenceFromAudit, substance } from "./substance";
import {
  classifyHeat,
  heatFromScore,
  type TerrainKind,
  type TerrainRecommendation,
  type TerrainZone,
} from "./temperature";

/** The audit columns the terrain reads. Matches the `audits` rows; scores arrive as numeric strings. */
export type TerrainAudit = {
  url: string;
  overallScore: string | number;
  seoScore: string | number;
  aioScore: string | number;
  createdAt: Date;
  wordCount: number;
  structuredDataCount: number;
  hasClearDefinitions: boolean;
  questionCount: number;
  payload: unknown;
};

/**
 * One page on the client's terrain, in the shape of the spectral engine's TerrainPoint so an
 * engine-produced terrain could replace this native one without touching the dashboard.
 */
export type TerrainPoint = {
  id: string;
  path: string;
  url: string;
  /** Health as a share of the overall score. Hot good, cold bad. */
  heat: number;
  /** Distance from healthy: 1 - heat. */
  shatter: number;
  /** Elevation: evidence density from the pack's counts. */
  substance: number;
  /** Visits-derived luminance. Null until telemetry exists. */
  attention: number | null;
  zone: TerrainZone;
  kind: TerrainKind;
  recommendation: TerrainRecommendation;
  scores: { overall: number; seo: number; aio: number };
  nearestCanonical: string | null;
  position: [number, number, number];
  auditedAt: string;
};

export type Terrain = {
  domain: string;
  geometry: "signal-terrain";
  version: "0.1";
  points: TerrainPoint[];
  /** One page is one hill; the UI says so rather than inventing a landscape. */
  singular: boolean;
};

export function pagePath(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    return pathname.replace(/\/+$/, "") || "/";
  } catch {
    return null;
  }
}

export function latestPerPath(auditsNewestFirst: TerrainAudit[]): Array<{ path: string; audit: TerrainAudit }> {
  const seen = new Map<string, TerrainAudit>();
  for (const audit of auditsNewestFirst) {
    const path = pagePath(audit.url);
    if (path === null || seen.has(path)) continue;
    seen.set(path, audit);
  }
  return Array.from(seen, ([path, audit]) => ({ path, audit }));
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** Deterministic layout: a golden-angle spiral inside the unit disk, the first point at the origin. */
export function spiralPositions(n: number): Array<[number, number, number]> {
  const positions: Array<[number, number, number]> = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      positions.push([0, 0, 0]);
      continue;
    }
    const r = Math.sqrt(i / (n - 1));
    const theta = i * GOLDEN_ANGLE;
    positions.push([r * Math.cos(theta), 0, r * Math.sin(theta)]);
  }
  return positions;
}

export function buildTerrain(auditsNewestFirst: TerrainAudit[], domain: string): Terrain {
  const pages = latestPerPath(auditsNewestFirst).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const positions = spiralPositions(pages.length);

  const points: TerrainPoint[] = pages.map(({ path, audit }, index) => {
    const overall = Number(audit.overallScore);
    const heat = heatFromScore(overall);
    const { zone, kind, recommendation } = classifyHeat(heat);
    return {
      id: path,
      path,
      url: audit.url,
      heat,
      shatter: 1 - heat,
      substance: substance(evidenceFromAudit(audit)),
      attention: null,
      zone,
      kind,
      recommendation,
      scores: { overall, seo: Number(audit.seoScore), aio: Number(audit.aioScore) },
      nearestCanonical: null,
      position: positions[index],
      auditedAt: audit.createdAt.toISOString(),
    };
  });

  const canonical = points.filter((point) => point.kind === "canonical");
  for (const point of points) {
    if (point.kind === "canonical" || canonical.length === 0) continue;
    let best: TerrainPoint | null = null;
    for (const candidate of canonical) {
      if (!best || Math.abs(candidate.substance - point.substance) < Math.abs(best.substance - point.substance)) {
        best = candidate;
      }
    }
    point.nearestCanonical = best?.path ?? null;
  }

  return { domain, geometry: "signal-terrain", version: "0.1", points, singular: points.length === 1 };
}
