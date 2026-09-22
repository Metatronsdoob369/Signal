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

