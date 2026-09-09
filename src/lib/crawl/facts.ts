import { crawlFactsSchema, type CrawlFacts } from "@/contracts";
import { KNOWN_BOTS, RETRIEVAL_ROLES, type KnownBot } from "./bots";
import { assertPublicHost, type LookupLike } from "./net";
import { evaluateRobots } from "./robots";

export const CRAWL_FACTS_TTL_MS = 24 * 60 * 60 * 1000;
/** A failed read is retried sooner than a good one; "unknown" should not stick for a day. */
export const CRAWL_ERROR_RETRY_MS = 60 * 60 * 1000;
export const CRAWL_FETCH_TIMEOUT_MS = 5_000;
export const CRAWL_MAX_BYTES = 262_144;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type PolicyFile = { status: "ok" | "missing" | "error"; text: string };

function looksLikeHtml(contentType: string | null, text: string): boolean {
  if (contentType && /text\/html|application\/xhtml/i.test(contentType)) return true;
  return /^\s*<(!doctype|html)/i.test(text.slice(0, 200));
}

/**
 * Signal's server reads one public policy file from the registered host. Same host only,
 * https only, one same-host redirect at most, hard timeout, byte cap. Nothing about the
 * visitor or the page body is involved.
 */
async function fetchPolicyFile(
  domain: string,
  path: string,
  fetchImpl: FetchLike,
  hop = 0,
): Promise<PolicyFile> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CRAWL_FETCH_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`https://${domain}${path}`, {
      method: "GET",
      redirect: "manual",
      signal: controller.signal,
      headers: { accept: "text/plain, */*;q=0.1", "user-agent": "SignalPolicyReader/0.2 (+robots.txt check)" },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || hop >= 1) return { status: "missing", text: "" };
      let target: URL;
      try {
        target = new URL(location, `https://${domain}${path}`);
      } catch {
        return { status: "missing", text: "" };
      }
      if (target.protocol !== "https:" || target.hostname.toLowerCase() !== domain) {
        return { status: "missing", text: "" };
      }
      return fetchPolicyFile(domain, `${target.pathname}${target.search}`, fetchImpl, hop + 1);
    }

    if (response.status === 404 || response.status === 410) return { status: "missing", text: "" };
    if (response.status !== 200) return { status: "error", text: "" };

    const declared = Number(response.headers.get("content-length") || "0");
    if (Number.isFinite(declared) && declared > CRAWL_MAX_BYTES) return { status: "error", text: "" };
    const text = (await response.text()).slice(0, CRAWL_MAX_BYTES);
    if (looksLikeHtml(response.headers.get("content-type"), text)) return { status: "missing", text: "" };
    return { status: "ok", text };
  } catch {
    return { status: "error", text: "" };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchCrawlFacts(
  domain: string,
  deps: { fetchImpl?: FetchLike; now?: () => Date; bots?: readonly KnownBot[]; lookup?: LookupLike } = {},
): Promise<CrawlFacts> {
  const fetchImpl = deps.fetchImpl ?? ((input, init) => fetch(input, init));
  const now = deps.now ?? (() => new Date());
  const bots = deps.bots ?? KNOWN_BOTS;

  // The server only ever connects to hosts that resolve to public addresses. A name that
  // points inside a private network, or does not resolve, is recorded as an error, never fetched.
  const host = await assertPublicHost(domain, deps.lookup);
  const [robots, llms] = host.ok
    ? await Promise.all([
        fetchPolicyFile(domain, "/robots.txt", fetchImpl),
        fetchPolicyFile(domain, "/llms.txt", fetchImpl),
      ])
    : [
        { status: "error", text: "" } satisfies PolicyFile,
        { status: "error", text: "" } satisfies PolicyFile,
      ];

  const tokens = bots.map((bot) => bot.token);
  const evaluation =
    robots.status === "ok"
      ? evaluateRobots(robots.text, tokens)
      : {
          bots: Object.fromEntries(tokens.map((token) => [token, "unspecified" as const])),
          sitemapDeclared: false,
          disallowAll: false,
        };

  return crawlFactsSchema.parse({
    fetchedAt: now().toISOString(),
    domain,
    robots: {
      status: robots.status,
      sitemapDeclared: evaluation.sitemapDeclared,
      disallowAll: evaluation.disallowAll,
      bots: evaluation.bots,
    },
    llmsTxt: { status: llms.status },
  });
}

export function crawlFactsStale(
  fetchedAt: Date | string | null | undefined,
  now = new Date(),
  ttlMs = CRAWL_FACTS_TTL_MS,
): boolean {
  if (!fetchedAt) return true;
  const at = typeof fetchedAt === "string" ? new Date(fetchedAt) : fetchedAt;
  if (Number.isNaN(at.getTime())) return true;
  return now.getTime() - at.getTime() > ttlMs;
}

/** TTL that applies to a stored snapshot: short after a failed read, a day after a good one. */
export function crawlFactsTtl(facts: CrawlFacts | null): number {
  return facts && facts.robots.status === "error" ? CRAWL_ERROR_RETRY_MS : CRAWL_FACTS_TTL_MS;
}

export type RetrievalAccessSummary = {
  /** Retrieval-time bots (fetcher + search) evaluated. */
  total: number;
  allowed: number;
  blocked: KnownBot[];
  trainersBlocked: KnownBot[];
};

export function retrievalAccessSummary(
  facts: CrawlFacts | null,
  bots: readonly KnownBot[] = KNOWN_BOTS,
): RetrievalAccessSummary | null {
  if (!facts || facts.robots.status === "error") return null;
  const blocked: KnownBot[] = [];
  const trainersBlocked: KnownBot[] = [];
  let total = 0;
  let allowed = 0;
  for (const bot of bots) {
    const access = facts.robots.bots[bot.token] ?? "unspecified";
    if (RETRIEVAL_ROLES.has(bot.role)) {
      total += 1;
      if (access === "disallow") blocked.push(bot);
      else allowed += 1;
    } else if (access === "disallow") {
      trainersBlocked.push(bot);
    }
  }
  return { total, allowed, blocked, trainersBlocked };
}

export function parseStoredCrawlFacts(value: unknown): CrawlFacts | null {
  const parsed = crawlFactsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
