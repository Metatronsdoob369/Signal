import { describe, expect, it } from "vitest";
import { KNOWN_BOTS, retrievalBots, trainingBots } from "@/lib/crawl/bots";
import {
  CRAWL_ERROR_RETRY_MS,
  CRAWL_FACTS_TTL_MS,
  crawlFactsStale,
  crawlFactsTtl,
  fetchCrawlFacts,
  parseStoredCrawlFacts,
  retrievalAccessSummary,
  type FetchLike,
} from "@/lib/crawl/facts";

const ROBOTS = "User-agent: GPTBot\nDisallow: /\n\nUser-agent: PerplexityBot\nDisallow: /\n\nUser-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n";

function respond(routes: Record<string, () => Response>): { fetchImpl: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (input) => {
    calls.push(input);
    const path = new URL(input).pathname;
    const handler = routes[path];
    if (!handler) return new Response("nope", { status: 404 });
    return handler();
  };
  return { fetchImpl, calls };
}

const now = () => new Date("2026-09-09T12:00:00.000Z");
const lookup = async () => ["93.184.216.34"];

describe("bots table", () => {
  it("separates retrieval agents from training crawlers", () => {
    const retrieval = new Set(retrievalBots().map((b) => b.token));
    const training = new Set(trainingBots().map((b) => b.token));
    expect(retrieval.has("OAI-SearchBot")).toBe(true);
    expect(retrieval.has("PerplexityBot")).toBe(true);
    expect(retrieval.has("Googlebot")).toBe(true);
    expect(training.has("GPTBot")).toBe(true);
    expect(training.has("CCBot")).toBe(true);
    expect(training.has("Google-Extended")).toBe(true);
    for (const token of retrieval) expect(training.has(token)).toBe(false);
    expect(retrieval.size + training.size).toBe(KNOWN_BOTS.length);
  });
});

describe("fetchCrawlFacts", () => {
  it("reads robots.txt and llms.txt from the registered host only", async () => {
    const { fetchImpl, calls } = respond({
      "/robots.txt": () => new Response(ROBOTS, { status: 200, headers: { "content-type": "text/plain" } }),
      "/llms.txt": () => new Response("# Example\n", { status: 200, headers: { "content-type": "text/plain" } }),
    });
    const facts = await fetchCrawlFacts("example.com", { fetchImpl, now, lookup });
    expect(calls.every((url) => url.startsWith("https://example.com/"))).toBe(true);
    expect(facts.robots.status).toBe("ok");
    expect(facts.robots.sitemapDeclared).toBe(true);
    expect(facts.robots.bots.GPTBot).toBe("disallow");
    expect(facts.robots.bots.PerplexityBot).toBe("disallow");
    expect(facts.robots.bots["OAI-SearchBot"]).toBe("allow");
    expect(facts.llmsTxt.status).toBe("ok");
    expect(facts.fetchedAt).toBe("2026-09-09T12:00:00.000Z");
  });

  it("treats 404 as missing and marks every bot unspecified", async () => {
    const { fetchImpl } = respond({});
    const facts = await fetchCrawlFacts("example.com", { fetchImpl, now, lookup });
    expect(facts.robots.status).toBe("missing");
    expect(facts.llmsTxt.status).toBe("missing");
    expect(new Set(Object.values(facts.robots.bots))).toEqual(new Set(["unspecified"]));
  });

  it("treats an HTML soft-404 as missing", async () => {
    const { fetchImpl } = respond({
      "/robots.txt": () => new Response("<!doctype html><html><body>Not found</body></html>", { status: 200, headers: { "content-type": "text/html" } }),
      "/llms.txt": () => new Response("<html>page</html>", { status: 200 }),
    });
    const facts = await fetchCrawlFacts("example.com", { fetchImpl, now, lookup });
    expect(facts.robots.status).toBe("missing");
    expect(facts.llmsTxt.status).toBe("missing");
  });

  it("follows one same-host https redirect and refuses off-host ones", async () => {
    const { fetchImpl, calls } = respond({
      "/robots.txt": () => new Response(null, { status: 301, headers: { location: "https://example.com/robots-real.txt" } }),
      "/robots-real.txt": () => new Response("User-agent: *\nDisallow: /", { status: 200, headers: { "content-type": "text/plain" } }),
      "/llms.txt": () => new Response(null, { status: 302, headers: { location: "https://evil.example.net/llms.txt" } }),
    });
    const facts = await fetchCrawlFacts("example.com", { fetchImpl, now, lookup });
    expect(facts.robots.status).toBe("ok");
    expect(facts.robots.disallowAll).toBe(true);
    expect(facts.llmsTxt.status).toBe("missing");
    expect(calls.some((url) => url.includes("evil.example.net"))).toBe(false);
  });

  it("records network failures as error, never as allow", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error("ECONNRESET");
    };
    const facts = await fetchCrawlFacts("example.com", { fetchImpl, now, lookup });
    expect(facts.robots.status).toBe("error");
    expect(facts.llmsTxt.status).toBe("error");
    expect(retrievalAccessSummary(facts)).toBeNull();
  });

  it("rejects oversized policy files", async () => {
    const { fetchImpl } = respond({
      "/robots.txt": () => new Response("x", { status: 200, headers: { "content-length": "9999999" } }),
    });
    const facts = await fetchCrawlFacts("example.com", { fetchImpl, now, lookup });
    expect(facts.robots.status).toBe("error");
  });
});

describe("fetchCrawlFacts host guard", () => {
  it("never fetches from a host that resolves to a private or local address", async () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "169.254.169.254", "192.168.0.1", "::1", "::ffff:10.0.0.5", "fd00::1"]) {
      const { fetchImpl, calls } = respond({ "/robots.txt": () => new Response("User-agent: *\nAllow: /", { status: 200 }) });
      const facts = await fetchCrawlFacts("intranet.example.com", { fetchImpl, now, lookup: async () => ["93.184.216.34", address] });
      expect(calls).toEqual([]);
      expect(facts.robots.status).toBe("error");
      expect(facts.llmsTxt.status).toBe("error");
      expect(retrievalAccessSummary(facts)).toBeNull();
    }
  });

  it("records an unresolvable host as error, never as missing", async () => {
    const { fetchImpl, calls } = respond({});
    const failing = async () => {
      throw new Error("ENOTFOUND");
    };
    const facts = await fetchCrawlFacts("nowhere.example.com", { fetchImpl, now, lookup: failing });
    expect(calls).toEqual([]);
    expect(facts.robots.status).toBe("error");
    const empty = await fetchCrawlFacts("nowhere.example.com", { fetchImpl, now, lookup: async () => [] });
    expect(empty.robots.status).toBe("error");
  });
});

describe("retrievalAccessSummary", () => {
  it("counts retrieval bots and lists blocked trainers separately", async () => {
    const { fetchImpl } = respond({
      "/robots.txt": () => new Response(ROBOTS, { status: 200 }),
    });
    const facts = await fetchCrawlFacts("example.com", { fetchImpl, now, lookup });
    const summary = retrievalAccessSummary(facts);
    expect(summary).not.toBeNull();
    expect(summary?.total).toBe(retrievalBots().length);
    expect(summary?.blocked.map((b) => b.token)).toEqual(["PerplexityBot"]);
    expect(summary?.trainersBlocked.map((b) => b.token)).toEqual(["GPTBot"]);
    expect(summary?.allowed).toBe(retrievalBots().length - 1);
  });

  it("is null without facts", () => {
    expect(retrievalAccessSummary(null)).toBeNull();
  });
});

describe("crawlFactsStale", () => {
  it("is stale when missing, invalid, or past the TTL", () => {
    const at = now();
    expect(crawlFactsStale(null, at)).toBe(true);
    expect(crawlFactsStale("garbage", at)).toBe(true);
    expect(crawlFactsStale(new Date(at.getTime() - CRAWL_FACTS_TTL_MS - 1), at)).toBe(true);
    expect(crawlFactsStale(new Date(at.getTime() - 1000), at)).toBe(false);
    expect(crawlFactsStale(new Date(at.getTime() - 1000).toISOString(), at)).toBe(false);
  });
});

describe("crawlFactsTtl", () => {
  it("retries a failed read within the hour and a good read after a day", async () => {
    const failing: FetchLike = async () => {
      throw new Error("down");
    };
    const errored = await fetchCrawlFacts("example.com", { fetchImpl: failing, now, lookup });
    expect(crawlFactsTtl(errored)).toBe(CRAWL_ERROR_RETRY_MS);
    const { fetchImpl } = respond({ "/robots.txt": () => new Response(ROBOTS, { status: 200 }) });
    const good = await fetchCrawlFacts("example.com", { fetchImpl, now, lookup });
    expect(crawlFactsTtl(good)).toBe(CRAWL_FACTS_TTL_MS);
    expect(crawlFactsTtl(null)).toBe(CRAWL_FACTS_TTL_MS);
    const at = now();
    const twoHoursLater = new Date(at.getTime() + 2 * 60 * 60 * 1000);
    expect(crawlFactsStale(at, twoHoursLater, crawlFactsTtl(errored))).toBe(true);
    expect(crawlFactsStale(at, twoHoursLater, crawlFactsTtl(good))).toBe(false);
  });
});

describe("parseStoredCrawlFacts", () => {
  it("returns null for anything that is not a facts document", () => {
    expect(parseStoredCrawlFacts(null)).toBeNull();
    expect(parseStoredCrawlFacts({ hello: "world" })).toBeNull();
  });
});
