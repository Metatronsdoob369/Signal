import { MIN_EXPERIMENT_IMPRESSIONS } from "@/lib/hard-nos";
import { engagementRate } from "./optimizer";

export type ExperimentRecord = {
  id: string;
  title: string;
  description: string;
  isDefault: boolean;
  source: string;
  impressions: number;
  successes: number;
};

export type PresentedExperiment = ExperimentRecord & {
  rate: number;
  needsImpressions: number;
};

export { engagementRate };

export function impressionsUntilDecision(
  impressions: number,
  min = MIN_EXPERIMENT_IMPRESSIONS,
): number {
  return Math.max(0, min - impressions);
}

export function presentExperimentRows(rows: ExperimentRecord[]): PresentedExperiment[] {
  return rows.map((row) => ({
    ...row,
    rate: engagementRate(row.impressions, row.successes),
    needsImpressions: impressionsUntilDecision(row.impressions),
  }));
}
