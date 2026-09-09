import { eq } from "drizzle-orm";
import { after } from "next/server";
import type { CrawlFacts } from "@/contracts";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { crawlFactsStale, crawlFactsTtl, fetchCrawlFacts, parseStoredCrawlFacts } from "./facts";

type SiteRow = typeof sites.$inferSelect;

const inflight = new Map<string, Promise<void>>();

/** Read the stored snapshot without touching the network. Null when absent or unparseable. */
export function storedCrawlFacts(site: Pick<SiteRow, "crawlFacts">): CrawlFacts | null {
  return parseStoredCrawlFacts(site.crawlFacts);
}

/**
 * Fetch robots.txt and llms.txt for the site and persist the snapshot. One refresh per
 * site at a time; a failed fetch is stored too so the dashboard can say "unknown"
 * instead of silently reusing old facts.
 */
export async function refreshCrawlFacts(siteId: string, domain: string): Promise<CrawlFacts | null> {
  const key = siteId;
  const existing = inflight.get(key);
  if (existing) {
    await existing;
    return null;
  }
  let facts: CrawlFacts | null = null;
  const job = (async () => {
    try {
      facts = await fetchCrawlFacts(domain);
      await db
        .update(sites)
        .set({ crawlFacts: facts, crawlFactsAt: new Date(facts.fetchedAt) })
        .where(eq(sites.id, siteId));
    } catch (error) {
      console.error("[crawl refresh]", error);
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, job);
  await job;
  return facts;
}

/**
 * Keep crawl facts off the request path. Schedules a refresh after the response is sent
 * when the snapshot is missing or older than the TTL.
 */
export function scheduleCrawlRefresh(
  site: Pick<SiteRow, "id" | "domain" | "crawlFactsAt"> & Partial<Pick<SiteRow, "crawlFacts">>,
): void {
  const ttl = crawlFactsTtl(parseStoredCrawlFacts(site.crawlFacts ?? null));
  if (!crawlFactsStale(site.crawlFactsAt, new Date(), ttl)) return;
  after(() => refreshCrawlFacts(site.id, site.domain));
}
