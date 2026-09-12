import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { audits, findings, sites } from "@/db/schema";
import { splitAuditsByScope } from "@/lib/audit-scope";
import { buildTerrain, pagePath } from "@/lib/terrain/build";
import { terrainDashboardEnabled } from "@/lib/terrain/flag";
import { hashToken } from "@/lib/token";
import { TerrainView, type Fix, type ViewMode } from "./terrain-view";
import "./terrain.css";

export const dynamic = "force-dynamic";

/** Terrain URLs carry the site token; they must never be indexed or followed. */
export const metadata: Metadata = { robots: { index: false, follow: false } };

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ view?: string }>;
};

const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

export default async function TerrainPage({ params, searchParams }: PageProps) {
  if (!terrainDashboardEnabled()) notFound();
  const { token } = await params;
  const { view } = await searchParams;

  const siteRows = await db
    .select()
    .from(sites)
    .where(eq(sites.tokenHash, hashToken(token)))
    .limit(1);
  if (siteRows.length === 0 || !siteRows[0].isActive) notFound();
  const site = siteRows[0];

  // Newest first. Only pages on the registered domain shape the terrain; Signal's own example
  // page never becomes ground.
  const recentAudits = await db
    .select()
    .from(audits)
    .where(eq(audits.siteId, site.id))
    .orderBy(desc(audits.createdAt))
    .limit(500);
  const scoped = splitAuditsByScope(recentAudits, site.domain);
  const terrain = buildTerrain(scoped.site, site.domain);

  // The repair vector for the most recently audited page: its failing rules, worst first.
  const latest = scoped.latestSite;
  const rows = latest
    ? await db.select().from(findings).where(eq(findings.auditId, latest.id)).limit(100)
    : [];
  const fixes: Fix[] = rows
    .filter((row) => row.severity !== "info")
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3))
    .slice(0, 3)
    .map((row) => ({ severity: row.severity, title: row.title, fix: row.fix }));

  const mode: ViewMode = view === "contour" ? "contour" : view === "scene" ? "scene" : "auto";

  return (
    <TerrainView
      terrain={terrain}
      site={{ domain: site.domain, name: site.name }}
      fixes={fixes}
      focusPath={latest ? pagePath(latest.url) : null}
      backHref={`/dashboard/${token}`}
      mode={mode}
    />
  );
}
