import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { experimentEvents, pages, variants } from "@/db/schema";
import type { BeaconPayload } from "@/contracts";
import { ENGAGE_SUCCESS_THRESHOLD, MAX_ACTIVE_VARIANTS } from "@/lib/hard-nos";
import { pickVariant } from "./bandit";
import { fitDescription, fitTitle, normalizePath, titleCasePath } from "./constraints";
import {
  choosePromotion,
  chooseRetirement,
  filterNewMutants,
  heuristicMutants,
  type VariantStat,
} from "./optimizer";
import { presentExperimentRows, type PresentedExperiment } from "./present";

export type ResolvedVariant = {
  variantId: string;
  title: string;
  description: string;
};

type VariantRow = typeof variants.$inferSelect;

function toStat(row: VariantRow, impressions: number, successes: number): VariantStat & VariantRow {
  return { ...row, impressions, successes };
}

async function variantStats(pageId: string): Promise<Array<VariantStat & VariantRow>> {
  const [active, events] = await Promise.all([
    db.select().from(variants).where(and(eq(variants.pageId, pageId), eq(variants.active, true))),
    db.select().from(experimentEvents).where(eq(experimentEvents.pageId, pageId)),
  ]);
  return active.map((row) => {
    const mine = events.filter((event) => event.variantId === row.id);
    const impressions = mine.filter((event) => event.type === "impression").length;
    const successes = mine.filter(
      (event) => event.type === "engage" && Number(event.value) >= ENGAGE_SUCCESS_THRESHOLD,
    ).length;
    return toStat(row, impressions, successes);
  });
}

export async function ensurePage(
  siteId: string,
  rawPath: string,
  title: string,
  description: string,
) {
  const path = normalizePath(rawPath);
  const existing = await db
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.path, path)))
    .limit(1);
  const page =
    existing[0] ??
    (
      await db
        .insert(pages)
        .values({ siteId, path })
        .returning()
    )[0];

  const current = await db.select().from(variants).where(eq(variants.pageId, page.id)).limit(1);
  if (current.length === 0) {
    const seedTitle = fitTitle(title || titleCasePath(path));
    const seedDescription = fitDescription(
      description || `Welcome to ${titleCasePath(path)}.`,
    );
    await db.insert(variants).values({
      pageId: page.id,
      title: seedTitle,
      description: seedDescription,
      isDefault: true,
      active: true,
      source: "seed",
    });
  }
  return page;
}

export async function resolveVariant(
  siteId: string,
  path: string,
  title: string,
  description: string,
): Promise<ResolvedVariant | null> {
  const page = await ensurePage(siteId, path, title, description);
  const stats = await variantStats(page.id);
  const picked = pickVariant(stats);
  if (!picked) return null;
  return {
    variantId: picked.id,
    title: picked.title,
    description: picked.description,
  };
}

export async function recordExperimentEvents(
  siteId: string,
  payload: BeaconPayload,
): Promise<number> {
  if (!payload.events.length) return 0;
  const path = payload.url ? new URL(payload.url).pathname : "/";
  const pageRows = await db
    .select()
    .from(pages)
    .where(and(eq(pages.siteId, siteId), eq(pages.path, normalizePath(path))))
    .limit(1);
  const page = pageRows[0];
  if (!page) return 0;

  await db.insert(experimentEvents).values(
    payload.events.map((event) => ({
      siteId,
      pageId: page.id,
      variantId: payload.variantId ?? null,
      type: event.type,
      metric: event.metric ?? null,
      value: String(event.value),
    })),
  );
  await optimizePage(page.id);
  return payload.events.length;
}

export async function optimizePage(pageId: string): Promise<void> {
  const stats = await variantStats(pageId);
  if (!stats.length) return;

  const promotion = choosePromotion(stats);
  if (promotion) {
    await db.update(variants).set({ isDefault: false }).where(eq(variants.pageId, pageId));
    await db.update(variants).set({ isDefault: true }).where(eq(variants.id, promotion.promoteId));
  }

  const retirement = chooseRetirement(stats);
  if (retirement) {
    await db.update(variants).set({ active: false }).where(eq(variants.id, retirement.retireId));
  }

  const after = await variantStats(pageId);
  const active = after.filter((row) => row.active);
  if (active.length >= MAX_ACTIVE_VARIANTS) return;

  const current = active.find((row) => row.isDefault) ?? active[0];
  if (!current) return;
  const history = await db.select().from(variants).where(eq(variants.pageId, pageId));
  const mutants = filterNewMutants(
    heuristicMutants({ title: current.title, description: current.description }),
    history.map((row) => ({ title: row.title, description: row.description })),
    MAX_ACTIVE_VARIANTS - active.length,
  );
  if (!mutants.length) return;
  await db.insert(variants).values(
    mutants.map((mutant) => ({
      pageId,
      title: mutant.title,
      description: mutant.description,
      isDefault: false,
      active: true,
      source: "heuristic",
    })),
  );
}

export async function loadExperimentBoard(siteId: string): Promise<
  Array<{ path: string; variants: PresentedExperiment[] }>
> {
  const sitePages = await db.select().from(pages).where(eq(pages.siteId, siteId));
  const boards: Array<{ path: string; variants: PresentedExperiment[] }> = [];
  for (const page of sitePages) {
    const stats = await variantStats(page.id);
    boards.push({
      path: page.path,
      variants: presentExperimentRows(
        stats.map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          isDefault: row.isDefault,
          source: row.source,
          impressions: row.impressions,
          successes: row.successes,
        })),
      ),
    });
  }
  return boards;
}
