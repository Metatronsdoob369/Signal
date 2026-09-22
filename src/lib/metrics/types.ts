export type SeriesPoint = {
  /** ISO date string YYYY-MM-DD for the bucket. */
  date: string;
  /** Primary numeric value for the bucket. Normalized to 0-100 when a score, raw count when a count. */
  value: number;
  /** Optional sample size represented by this bucket (e.g., number of audits contributing). */
  sampleSize?: number;
};

export type MetricWindow =
  | { kind: "days"; days: number } // e.g., last 7 days
  | { kind: "latest_audit" } // compares the latest site audit to the previous one
  | { kind: "snapshot" }; // point-in-time reading (no trend window)

/** A computed metric for dashboard tiles. Pure data — no DB or UI concerns. */
export type MetricComputation = {
  /** Current period's primary value (0–100 for scores/percentages, raw for counts). Null when unknown. */
  current: number | null;
  /** Previous period's value, if available. */
  previous: number | null;
  /**
   * Signed change = current − previous. Only present when both periods have values.
   * For "down-good" tiles (like open fixes), a negative delta is an improvement.
   */
  delta: number | null;
  /** Total sample size contributing to the current period. 0 when unknown or not applicable. */
  sampleSize: number;
  /** Human-readable window label to render under the number, e.g., "last 7 days". */
  windowLabel: string;
  /** Optional time series for sparklines — newest last, covering the current window at least. */
  series?: SeriesPoint[];
};

/** Whether an increase is good or bad for the reader. */
export type Directionality = "up-good" | "down-good";

/** Static metadata to help render a tile consistently. */
export type MetricTileSpec = {
  /** Short label to display on the tile header. */
  label: string;
  /** How to judge a delta. */
  direction: Directionality;
  /** Unit for formatting the primary number. */
  unit: "score" | "count" | "percent";
};

export type MetricKey =
  | "aio_score"
  | "seo_score"
  | "open_fixes"
  | "crawl_access"
  // Scaffolds — intentionally unknown until visit/contact/vitals rollups land
  | "visits"
  | "contact_actions"
  | "speed";

