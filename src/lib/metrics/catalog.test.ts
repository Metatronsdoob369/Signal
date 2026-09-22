import { describe, expect, it } from "vitest";
import type { RetrievalAccessSummary } from "@/lib/crawl/facts";
import { deriveCrawlAccessPercent, deriveOpenFixesLatest, deriveScoreOver7d, type AuditLike } from "./catalog";

function audit(url: string, dayOffset: number, scores: Partial<Pick<AuditLike, "seoScore" | "aioScore">>): AuditLike {
  const now = new Date(Date.UTC(2026, 8, 22)); // 2026-09-22 UTC
  now.setUTCDate(now.getUTCDate() + dayOffset);
  return {
    url,
    createdAt: now,
    seoScore: 70,
    aioScore: 65,
    ...scores,
  };
}

describe("deriveScoreOver7d", () => {
  it("averages daily scores over the last 7 days and compares to the previous window", () => {
    const now = new Date(Date.UTC(2026, 8, 22)); // 2026-09-22
    const domain = "example.com";
    const audits = [
      // Site audits spread across 10 days
      audit("https://example.com/a", -0, { aioScore: 60 }),
      audit("https://example.com/b", -1, { aioScore: 62 }),
      audit("https://example.com/b", -1, { aioScore: 58 }),
      audit("https://example.com/c", -3, { aioScore: 64 }),
      audit("https://example.com/d", -6, { aioScore: 66 }),
      audit("https://example.com/e", -8, { aioScore: 70 }), // falls into previous 7-day window
      audit("https://signal.run/demo", -2, { aioScore: 10 }), // out-of-scope (app), ignored
    ];
    const result = deriveScoreOver7d(audits, domain, "aioScore", now);
    expect(result.windowLabel).toBe("last 7 days");
    expect(result.current).toBeGreaterThan(0);
    // Previous exists due to the -8 day audit
    expect(result.previous).not.toBeNull();
    expect(result.delta).not.toBeNull();
    // Sample size counts audits in the current 7-day window, not days
    expect(result.sampleSize).toBe(5); // excludes the app-scope audit
    expect(result.series?.length).toBe(7);
  });

  it("returns unknown when no site-scope audits exist", () => {
    const now = new Date(Date.UTC(2026, 8, 22));
    const domain = "example.com";
    const audits: AuditLike[] = [audit("https://other.com/a", -0, { aioScore: 60 })];
    const result = deriveScoreOver7d(audits, domain, "aioScore", now);
    expect(result.current).toBeNull();
    expect(result.previous).toBeNull();
    expect(result.delta).toBeNull();
    expect(result.sampleSize).toBe(0);
  });
});

describe("deriveOpenFixesLatest", () => {
  it("counts findings on the latest and previous site audits", () => {
    const siteAudits = [{ id: "a1" }, { id: "a0" }];
    const map = new Map<string, Array<{ auditId: string; severity: string }>>();
    map.set("a1", [
      { auditId: "a1", severity: "major" },
      { auditId: "a1", severity: "minor" },
    ]);
    map.set("a0", [{ auditId: "a0", severity: "major" }]);
    const result = deriveOpenFixesLatest(siteAudits, map);
    expect(result.current).toBe(2);
    expect(result.previous).toBe(1);
    expect(result.delta).toBe(1);
    expect(result.sampleSize).toBe(2);
    expect(result.windowLabel).toBe("latest audit");
  });
});

describe("deriveCrawlAccessPercent", () => {
  it("computes allowed/total percentage when facts exist", () => {
    const access: RetrievalAccessSummary = {
      total: 5,
      allowed: 3,
      blocked: [],
      trainersBlocked: [],
    };
    const result = deriveCrawlAccessPercent(access);
    expect(result.current).toBeCloseTo(60, 5);
    expect(result.sampleSize).toBe(5);
    expect(result.delta).toBeNull();
  });

  it("returns unknown when facts are missing", () => {
    const result = deriveCrawlAccessPercent(null);
    expect(result.current).toBeNull();
    expect(result.sampleSize).toBe(0);
  });
});

