import {
  MAX_ACTIVE_VARIANTS,
  MIN_EXPERIMENT_IMPRESSIONS,
  PROMOTE_RATE_RATIO,
} from "@/lib/hard-nos";
import { acceptVariant, fitDescription, fitTitle, variantKey } from "./constraints";

export type VariantStat = {
  id: string;
  isDefault: boolean;
  active: boolean;
  impressions: number;
  successes: number;
};

export type MetaPair = {
  title: string;
  description: string;
};

export function engagementRate(impressions: number, successes: number): number {
  return impressions ? successes / impressions : 0;
}

export function choosePromotion(stats: VariantStat[]): { promoteId: string } | null {
  const def = stats.find((row) => row.isDefault) ?? stats[0];
  if (!def || def.impressions < MIN_EXPERIMENT_IMPRESSIONS) return null;
  const challengers = stats.filter(
    (row) => !row.isDefault && row.impressions >= MIN_EXPERIMENT_IMPRESSIONS,
  );
  if (!challengers.length) return null;
  const best = challengers.reduce((lead, row) =>
    engagementRate(row.impressions, row.successes) > engagementRate(lead.impressions, lead.successes)
      ? row
      : lead,
  );
  const defRate = engagementRate(def.impressions, def.successes);
  const bestRate = engagementRate(best.impressions, best.successes);
  if (bestRate > defRate * PROMOTE_RATE_RATIO) {
    return { promoteId: best.id };
  }
  return null;
}

export function chooseRetirement(stats: VariantStat[]): { retireId: string } | null {
  const active = stats.filter((row) => row.active);
  if (active.length <= MAX_ACTIVE_VARIANTS) return null;
  const losers = active.filter(
    (row) => !row.isDefault && row.impressions >= MIN_EXPERIMENT_IMPRESSIONS,
  );
  if (losers.length < 2) return null;
  const worst = losers.reduce((lead, row) =>
    engagementRate(row.impressions, row.successes) < engagementRate(lead.impressions, lead.successes)
      ? row
      : lead,
  );
  return { retireId: worst.id };
}

export function heuristicMutants(content: MetaPair): MetaPair[] {
  const year = new Date().getFullYear();
  const title = content.title.trim();
  const description = content.description.trim();
  const titles = new Set<string>([title]);
  if (!/\d{4}/.test(title)) titles.add(fitTitle(`${title} (${year})`));
  titles.add(fitTitle(`${title}: What to Know`));
  titles.add(fitTitle(`${title} — Complete Guide`));
  if (!/^(best|top)\b/i.test(title) && title.length > 0) {
    titles.add(fitTitle(`Best ${title.charAt(0).toLowerCase()}${title.slice(1)}`));
  }

  const descriptions = new Set<string>([fitDescription(description)]);
  descriptions.add(fitDescription(`${description.replace(/\.\s*$/, "")}. Get started today.`));

  const incumbent = variantKey(title, description);
  const out: MetaPair[] = [];
  const seen = new Set<string>([incumbent]);

  for (const nextTitle of titles) {
    if (nextTitle === title) continue;
    const pair = { title: nextTitle, description: fitDescription(description) };
    const key = variantKey(pair.title, pair.description);
    if (seen.has(key) || !acceptVariant(pair.title, pair.description)) continue;
    seen.add(key);
    out.push(pair);
  }

  for (const nextDescription of descriptions) {
    const pair = { title: fitTitle(title), description: nextDescription };
    const key = variantKey(pair.title, pair.description);
    if (seen.has(key) || !acceptVariant(pair.title, pair.description)) continue;
    seen.add(key);
    out.push(pair);
  }

  return out;
}

export function filterNewMutants(
  candidates: MetaPair[],
  existing: MetaPair[],
  remainingSlots: number,
): MetaPair[] {
  const seen = new Set(existing.map((pair) => variantKey(pair.title, pair.description)));
  const out: MetaPair[] = [];
  for (const candidate of candidates) {
    if (out.length >= remainingSlots) break;
    const key = variantKey(candidate.title, candidate.description);
    if (seen.has(key) || !acceptVariant(candidate.title, candidate.description)) continue;
    seen.add(key);
    out.push(candidate);
  }
  return out;
}
