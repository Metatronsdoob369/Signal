import { pageScope } from "@/lib/tenant";

export type ScopedAudits<T> = {
  site: T[];
  app: T[];
  latestSite: T | null;
  latestApp: T | null;
};

/**
 * Split audits (newest first) into the site's own pages and Signal-hosted example pages.
 * An audit whose URL does not parse is kept out of site scope so it can never head the dashboard.
 */
export function splitAuditsByScope<T extends { url: string }>(
  auditsNewestFirst: readonly T[],
  siteDomain: string,
): ScopedAudits<T> {
  const site: T[] = [];
  const app: T[] = [];
  for (const audit of auditsNewestFirst) {
    (pageScope(audit.url, siteDomain) === "site" ? site : app).push(audit);
  }
  return { site, app, latestSite: site[0] ?? null, latestApp: app[0] ?? null };
}
