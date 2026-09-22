import { pageScope } from "@/lib/tenant";
import { retrievalAccessSummary } from "@/lib/crawl/facts";
import type { MetricComputation, MetricKey, MetricTileSpec, SeriesPoint } from "./types";

// Minimal shapes to decouple from Drizzle types in tests
export type AuditLike = {
  url: string;
  createdAt: Date;
  seoScore: unknown;
  aioScore: unknown;
};

export type FindingLike = {
  auditId: string;
  severity: string;
};

type FindingsByAudit = Map<string, FindingLike[]>;

export const METRIC_SPECS: Record<MetricKey, MetricTileSpec> = {
  aio_score: { label: "AIO score", direction: "up-good", unit: "score" },
  seo_score: { label: "SEO score", direction: "up-good", unit: "score" },
  open_fixes: { label: "Open fixes", direction: "down-good", unit: "count" },
  crawl_access: { label: "AI crawler access", direction: "up-good", unit: "percent" },
  visits: { label: "Visits", direction: "up-good", unit: "count" },
  contact_actions: { label: "Contact actions", direction: "up-good", unit: "count" },
  speed: { label: "Speed", direction: "up-good", unit: "score" },
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatIsoDate(day: Date): string {
  const y = day.getUTCFullYear();
  const m = String(day.getUTCMonth() + 1).padStart(2, "0");
  const d = String(day.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfUtcDay(day: Date): Date {
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
}

function addDays(day: Date, delta: number): Date {
  const t = new Date(day);
  t.setUTCDate(t.getUTCDate() + delta);
  return t;
}

/**
 * From newest-first site audits, build a daily series for one score key limited to a date range.
 * The point value is the arithmetic mean of all audits on that day for the score.
 */
function dailySeriesFromAudits(
  auditsNewestFirst: readonly AuditLike[],
  scoreKey: "aioScore" | "seoScore",
  siteDomain: string,
  fromInclusive: Date,
  toInclusive: Date,
): SeriesPoint[] {
  // Bucket audits by UTC day, filtered to site scope
  const buckets = new Map<string, number[]>();
  const samples = new Map<string, number>();
  for (const a of auditsNewestFirst) {
    if (pageScope(a.url, siteDomain) !== "site") continue;
    const day = startOfUtcDay(a.createdAt);
    if (day < startOfUtcDay(fromInclusive) || day > startOfUtcDay(toInclusive)) continue;
    const key = formatIsoDate(day);
    const score = toNumber(a[scoreKey]);
    if (score === null) continue;
    const arr = buckets.get(key) ?? [];
    arr.push(score);
    buckets.set(key, arr);
    samples.set(key, (samples.get(key) ?? 0) + 1);
  }
  // Build dense series across range (include days with no data for sparkline continuity)
  const series: SeriesPoint[] = [];
  let day = startOfUtcDay(fromInclusive);
  const end = startOfUtcDay(toInclusive);
  while (day <= end) {
    const key = formatIsoDate(day);
    const arr = buckets.get(key);
    if (arr && arr.length > 0) {
      const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
      series.push({ date: key, value: avg, sampleSize: samples.get(key) ?? arr.length });
    } else {
      series.push({ date: key, value: NaN, sampleSize: 0 }); // gaps render as breaks
    }
    day = addDays(day, 1);
  }
  return series;
}

function windowAverage(series: SeriesPoint[]): { avg: number | null; sampleSize: number } {
  const vals: number[] = [];
  let samples = 0;
  for (const p of series) {
    if (Number.isFinite(p.value)) {
      vals.push(p.value);
      samples += p.sampleSize ?? 0;
    }
  }
  if (vals.length === 0) return { avg: null, sampleSize: 0 };
  return { avg: vals.reduce((s, v) => s + v, 0) / vals.length, sampleSize: samples };
}

export function deriveScoreOver7d(
  auditsNewestFirst: readonly AuditLike[],
  siteDomain: string,
  scoreKey: "aioScore" | "seoScore",
  now = new Date(),
): MetricComputation {
  const today = startOfUtcDay(now);
  const currentStart = addDays(today, -6); // include today → 7 days
  const previousStart = addDays(currentStart, -7);
  const previousEnd = addDays(currentStart, -1);

  const currentSeries = dailySeriesFromAudits(auditsNewestFirst, scoreKey, siteDomain, currentStart, today);
  const previousSeries = dailySeriesFromAudits(
    auditsNewestFirst,
    scoreKey,
    siteDomain,
    previousStart,
    previousEnd,
  );

  const { avg: current, sampleSize } = windowAverage(currentSeries);
  const { avg: previous } = windowAverage(previousSeries);
  const delta = current !== null && previous !== null ? current - previous : null;

  return {
    current,
    previous,
    delta,
    sampleSize,
    windowLabel: "last 7 days",
    series: currentSeries,
  };
}

export function deriveOpenFixesLatest(
  siteAuditsNewestFirst: readonly { id: string }[],
  findingsByAudit: FindingsByAudit,
): MetricComputation {
  const latest = siteAuditsNewestFirst[0]?.id;
  const prev = siteAuditsNewestFirst[1]?.id;
  const latestCount = latest ? (findingsByAudit.get(latest)?.length ?? 0) : null;
  const prevCount = prev ? (findingsByAudit.get(prev)?.length ?? 0) : null;
  const delta = latestCount !== null && prevCount !== null ? latestCount - prevCount : null;
  return {
    current: latestCount,
    previous: prevCount,
    delta,
    sampleSize: latestCount ?? 0,
    windowLabel: "latest audit",
  };
}

export type RetrievalAccess = ReturnType<typeof retrievalAccessSummary>;

export function deriveCrawlAccessPercent(access: RetrievalAccess): MetricComputation {
  if (!access) {
    return {
      current: null,
      previous: null,
      delta: null,
      sampleSize: 0,
      windowLabel: "as of last crawl",
    };
  }
  const { total, allowed } = access;
  const pct = total > 0 ? (allowed / total) * 100 : null;
  return {
    current: pct,
    previous: null,
    delta: null,
    sampleSize: total,
    windowLabel: "as of last crawl",
  };
}

// ---------- Phase 1: visit/contact/speed derives from daily rollups ----------

export type VisitRollupLike = {
  /** ISO date YYYY-MM-DD */
  day: string;
  visits: number;
  contacts?: number;
  lcpP75?: number | null;
  inpP75?: number | null;
  clsP75?: number | null;
};

function seriesFromRollups(
  rollups: readonly VisitRollupLike[],
  fromInclusive: Date,
  toInclusive: Date,
  pick: (r: VisitRollupLike) => number | null | undefined,
): SeriesPoint[] {
  const map = new Map<string, number | null | undefined>();
  for (const r of rollups) map.set(r.day, pick(r));
  const series: SeriesPoint[] = [];
  let d = startOfUtcDay(fromInclusive);
  const end = startOfUtcDay(toInclusive);
  while (d <= end) {
    const key = formatIsoDate(d);
    const v = map.get(key);
    series.push({
      date: key,
      value: v == null ? NaN : Number(v),
      sampleSize: 0,
    });
    d = addDays(d, 1);
  }
  return series;
}

function windowSum(rollups: readonly VisitRollupLike[], fromInclusive: Date, toInclusive: Date, pick: (r: VisitRollupLike) => number): number {
  let total = 0;
  for (const r of rollups) {
    const d = new Date(r.day + "T00:00:00Z");
    if (d < startOfUtcDay(fromInclusive) || d > startOfUtcDay(toInclusive)) continue;
    total += pick(r);
  }
  return total;
}

export function deriveVisitsOver7d(rollups: readonly VisitRollupLike[], now = new Date()): MetricComputation {
  const today = startOfUtcDay(now);
  const currentStart = addDays(today, -6);
  const previousStart = addDays(currentStart, -7);
  const previousEnd = addDays(currentStart, -1);
  const currentSeries = seriesFromRollups(rollups, currentStart, today, (r) => r.visits);
  const current = windowSum(rollups, currentStart, today, (r) => r.visits);
  const previous = windowSum(rollups, previousStart, previousEnd, (r) => r.visits);
  const delta = Number.isFinite(current) && Number.isFinite(previous) ? current - previous : null;
  return {
    current,
    previous,
    delta,
    sampleSize: current,
    windowLabel: "last 7 days",
    series: currentSeries,
  };
}

export function deriveContactActionsOver7d(rollups: readonly VisitRollupLike[], now = new Date()): MetricComputation {
  const today = startOfUtcDay(now);
  const currentStart = addDays(today, -6);
  const previousStart = addDays(currentStart, -7);
  const previousEnd = addDays(currentStart, -1);
  const currentSeries = seriesFromRollups(rollups, currentStart, today, (r) => r.contacts ?? 0);
  const current = windowSum(rollups, currentStart, today, (r) => r.contacts ?? 0);
  const previous = windowSum(rollups, previousStart, previousEnd, (r) => r.contacts ?? 0);
  const delta = Number.isFinite(current) && Number.isFinite(previous) ? current - previous : null;
  return {
    current,
    previous,
    delta,
    sampleSize: current,
    windowLabel: "last 7 days",
    series: currentSeries,
  };
}

// Core Web Vitals thresholds (good/poor) used for piecewise-linear scoring
const LCP_GOOD = 2500;
const LCP_POOR = 4000;
const INP_GOOD = 200;
const INP_POOR = 500;
const CLS_GOOD = 0.1;
const CLS_POOR = 0.25;

function scoreFromThresholds(value: number | null | undefined, good: number, poor: number, lowerIsBetter: boolean): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const v = Number(value);
  if (lowerIsBetter) {
    if (v <= good) return 100;
    if (v >= poor) return 0;
    return Math.max(0, Math.min(100, Math.round(((poor - v) / (poor - good)) * 100)));
  } else {
    if (v >= good) return 100;
    if (v <= poor) return 0;
    return Math.max(0, Math.min(100, Math.round(((v - poor) / (good - poor)) * 100)));
  }
}

function speedScore(lcpMs: number | null | undefined, inpMs: number | null | undefined, cls: number | null | undefined): number | null {
  // Piecewise-linear scores: lower is better for all three; equal weights.
  const lcpScore = scoreFromThresholds(lcpMs, LCP_GOOD, LCP_POOR, true);
  const inpScore = scoreFromThresholds(inpMs, INP_GOOD, INP_POOR, true);
  const clsScore = scoreFromThresholds(cls, CLS_GOOD, CLS_POOR, true);
  const parts = [lcpScore, inpScore, clsScore].filter((v): v is number => v != null);
  if (parts.length === 0) return null;
  return Math.round(parts.reduce((s, v) => s + v, 0) / parts.length);
}

export function deriveSpeedOver7d(rollups: readonly VisitRollupLike[], now = new Date()): MetricComputation {
  const today = startOfUtcDay(now);
  const currentStart = addDays(today, -6);
  const previousStart = addDays(currentStart, -7);
  const previousEnd = addDays(currentStart, -1);

  // Daily speed score series from daily p75 vitals
  const currentSeries = seriesFromRollups(rollups, currentStart, today, (r) =>
    speedScore(r.lcpP75 ?? null, r.inpP75 ?? null, r.clsP75 ?? null),
  );
  const { avg: current } = windowAverage(currentSeries);
  const previousWindowSeries = seriesFromRollups(rollups, previousStart, previousEnd, (r) =>
    speedScore(r.lcpP75 ?? null, r.inpP75 ?? null, r.clsP75 ?? null),
  );
  const { avg: previous } = windowAverage(previousWindowSeries);
  const delta = current !== null && previous !== null ? current - previous : null;
  // Sample size: visits in window (proxy for vitals sample)
  const visitsInWindow = windowSum(rollups, currentStart, today, (r) => r.visits);
  return {
    current,
    previous,
    delta,
    sampleSize: visitsInWindow,
    windowLabel: "last 7 days",
    series: currentSeries,
  };
}

