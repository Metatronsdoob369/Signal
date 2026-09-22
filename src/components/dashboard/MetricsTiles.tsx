import { temperatureHex, heatFromScore, classifyHeat } from "@/lib/terrain/temperature";
import type { MetricComputation, MetricTileSpec } from "@/lib/metrics/types";
import React from "react";

type TileProps = {
  id: string;
  spec: MetricTileSpec;
  data: MetricComputation;
};

function formatPrimary(value: number | null, unit: MetricTileSpec["unit"]): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (unit === "percent") return `${Math.round(value)}%`;
  if (unit === "score") return `${Math.round(value)}`;
  return `${Math.round(value)}`;
}

function Delta({ value, direction }: { value: number; direction: "up-good" | "down-good" }) {
  const good = direction === "up-good" ? value > 0 : value < 0;
  const arrow = value === 0 ? "→" : value > 0 ? "↑" : "↓";
  // Temperature-based accent for positive deltas on score/percent tiles, grayscale otherwise.
  const color =
    good && Math.abs(value) > 0
      ? temperatureHex(heatFromScore(70)) // warm copper accent without traffic lights
      : "currentColor";
  return (
    <span className="font-mono text-xs" style={{ color }}>
      {arrow} {value > 0 ? "+" : ""}
      {Math.round(value)}
    </span>
  );
}

function Sparkline({ series }: { series?: { value: number }[] }) {
  if (!series || series.length < 2) return null;
  // Build a simple normalized polyline; gaps (NaN) break into segments (omitted).
  const values = series.map((p) => (Number.isFinite(p.value) ? p.value : null));
  const present = values.filter((v): v is number => v !== null);
  if (present.length < 2) return null;
  const min = Math.min(...present);
  const max = Math.max(...present);
  const range = max - min || 1;
  const points: string[] = [];
  values.forEach((v, i) => {
    if (v === null) return;
    const x = (i / (values.length - 1)) * 100;
    const y = 100 - ((v - min) / range) * 100;
    points.push(`${x},${y}`);
  });
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-6 w-full">
      <polyline
        fill="none"
        stroke={temperatureHex(heatFromScore(65))}
        strokeWidth="2"
        points={points.join(" ")}
      />
    </svg>
  );
}

export function MetricsTiles({ tiles }: { tiles: Array<TileProps> }) {
  if (tiles.length === 0) return null;
  return (
    <section className="mt-8" data-testid="metrics-tiles">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ id, spec, data }) => {
          // For score tiles, add a tiny zone word to help non-technical readers.
          const zone =
            spec.unit === "score" && data.current != null
              ? classifyHeat(heatFromScore(data.current)).zone
              : null;
          return (
            <div
              key={id}
              className="border border-[var(--line)] bg-white p-4"
              data-testid={`metric-${id}`}
            >
              <p className="font-mono text-xs text-[var(--muted)]">{spec.label}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <p className="font-mono text-3xl font-semibold">
                  {formatPrimary(data.current, spec.unit)}
                </p>
                {data.delta != null ? <Delta value={data.delta} direction={spec.direction} /> : null}
              </div>
              {zone ? (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  {zone}
                </p>
              ) : null}
              <div className="mt-3">
                <Sparkline series={data.series} />
              </div>
              <p className="mt-2 font-mono text-[10px] text-[var(--muted)]">
                {data.windowLabel}
                {data.sampleSize > 0 ? ` · n=${data.sampleSize}` : ""}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

