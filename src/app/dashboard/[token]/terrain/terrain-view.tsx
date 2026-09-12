"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import type { Terrain, TerrainPoint } from "@/lib/terrain/build";
import { HEAT_BANDS, classifyHeat, heatFromScore, temperatureHex } from "@/lib/terrain/temperature";
import { ContourMap } from "./contour-map";

const TerrainScene = dynamic(() => import("./terrain-scene").then((m) => m.TerrainScene), {
  ssr: false,
  loading: () => null,
});

export type Fix = { severity: string; title: string; fix: string | null };
export type ViewMode = "auto" | "scene" | "contour";

type Props = {
  terrain: Terrain;
  site: { domain: string; name: string | null };
  fixes: Fix[];
  focusPath: string | null;
  backHref: string;
  mode: ViewMode;
};

type Surface = "scene" | "contour";
let detected: Surface | null = null;

/**
 * WebGL decides the surface. Reduced motion does not: the scene honours it by standing still
 * (no orbit, no parallax), so the client still gets the terrain.
 */
function supportsScene(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function subscribeSurface(): () => void {
  return () => {};
}

function surfaceSnapshot(): Surface {
  if (!detected) detected = supportsScene() ? "scene" : "contour";
  return detected;
}

function surfaceServerSnapshot(): Surface | null {
  return null;
}

const ZONE_WORD = { hot: "Hot", warm: "Warm", cold: "Cold" } as const;
const RECOMMENDATION_WORD = { ANCHOR: "anchor", REVIEW: "review", SHATTER_RESOLVE: "resolve" } as const;

export const RAMP_GRADIENT = `linear-gradient(90deg, ${temperatureHex(0)} 0%, ${temperatureHex(0.4)} 40%, ${temperatureHex(
  HEAT_BANDS.warm,
)} 60%, ${temperatureHex(HEAT_BANDS.hot)} 80%, ${temperatureHex(1)} 100%)`;

function ScoreTile({ label, value, testId }: { label: string; value: number; testId: string }) {
  const heat = heatFromScore(value);
  const { zone } = classifyHeat(heat);
  return (
    <div className="terrain-tile">
      <p className="terrain-eyebrow">{label}</p>
      <p className="terrain-number" data-testid={testId}>
        {Math.round(value)}
      </p>
      <p className="terrain-zone">
        <span className="terrain-dot" style={{ background: temperatureHex(heat) }} aria-hidden="true" />
        {ZONE_WORD[zone]}
      </p>
    </div>
  );
}

function pluralPages(n: number): string {
  return n === 1 ? "1 page" : `${n} pages`;
}

export function TerrainView({ terrain, site, fixes, focusPath, backHref, mode }: Props) {
  const detectedSurface = useSyncExternalStore(subscribeSurface, surfaceSnapshot, surfaceServerSnapshot);
  const surface: Surface | null = mode === "auto" ? detectedSurface : mode;

  const focus: TerrainPoint | null =
    terrain.points.find((point) => point.path === focusPath) ?? terrain.points[0] ?? null;
  const empty = terrain.points.length === 0;

  return (
    <main className="terrain-root" data-testid="terrain-root">
      {!empty && surface ? (
        <div className="terrain-surface" data-testid="terrain-surface" data-mode={surface}>
          {surface === "scene" ? (
            <TerrainScene terrain={terrain} />
          ) : (
            <ContourMap terrain={terrain} focusPath={focus?.path ?? null} />
          )}
        </div>
      ) : null}

      <header className="terrain-glass terrain-title">
        <p className="terrain-eyebrow">Signal · Terrain</p>
        <h1 className="terrain-h1">{site.name || site.domain}</h1>
        <p className="terrain-sub">{site.domain}</p>
        {!empty ? (
          <p className="terrain-sub" data-testid="terrain-point-count">
            {pluralPages(terrain.points.length)}
            {terrain.singular ? (
              <span data-testid="terrain-singular"> · one hill. The terrain grows as pages are published.</span>
            ) : null}
          </p>
        ) : null}
        <div className="terrain-legend" aria-label="Hot is good, cold is bad">
          <span className="terrain-legend-word">Cold</span>
          <span className="terrain-ramp" style={{ background: RAMP_GRADIENT }} aria-hidden="true" />
          <span className="terrain-legend-word">Hot</span>
        </div>
        <p className="terrain-law">Hot good. Cold bad. Height is substance: the evidence a page gives a model.</p>
      </header>

      <Link href={backHref} className="terrain-glass terrain-back" data-testid="terrain-back">
        ← Dashboard
      </Link>

      {empty ? (
        <section className="terrain-glass terrain-empty" data-testid="terrain-empty">
          <p className="terrain-eyebrow">No ground yet</p>
          <p className="terrain-body">
            The terrain forms after the first load of a page on {site.domain} with the embed script. Signal
            never draws a landscape it has not measured.
          </p>
        </section>
      ) : null}

      {focus ? (
        <section className="terrain-glass terrain-tiles" aria-label="Scores for the latest audited page">
          <p className="terrain-eyebrow terrain-tiles-path">
            <span className="terrain-mono">{focus.path}</span>
            <span className="terrain-muted">
              {" "}
              · {ZONE_WORD[focus.zone].toLowerCase()} · {RECOMMENDATION_WORD[focus.recommendation]}
            </span>
          </p>
          <div className="terrain-tile-row">
            <ScoreTile label="Overall" value={focus.scores.overall} testId="terrain-score-overall" />
            <ScoreTile label="SEO" value={focus.scores.seo} testId="terrain-score-seo" />
            <ScoreTile label="AIO" value={focus.scores.aio} testId="terrain-score-aio" />
            <div className="terrain-tile">
              <p className="terrain-eyebrow">Substance</p>
              <p className="terrain-number" data-testid="terrain-substance">
                {focus.substance.toFixed(2)}
              </p>
              <p className="terrain-zone terrain-muted">elevation</p>
            </div>
          </div>
        </section>
      ) : null}

      {focus && fixes.length > 0 ? (
        <section className="terrain-glass terrain-fixes" data-testid="terrain-fixes">
          <p className="terrain-eyebrow">Next fixes · warms {focus.path}</p>
          <ol className="terrain-fix-list">
            {fixes.map((fix) => (
              <li key={`${fix.severity}:${fix.title}`} className="terrain-fix">
                <span className={`terrain-severity terrain-severity-${fix.severity}`}>{fix.severity}</span>
                <span className="terrain-fix-title">{fix.title}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </main>
  );
}
