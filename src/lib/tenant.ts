/**
 * Reserved and private-network suffixes. Signal's server fetches robots.txt for every
 * registered host, so names that can only resolve inside a private network are refused.
 */
const RESERVED_TLDS = new Set([
  "localhost",
  "local",
  "internal",
  "lan",
  "home",
  "intranet",
  "corp",
  "test",
  "invalid",
  "example",
  "onion",
]);

export function isValidHostname(domain: string): boolean {
  if (!domain || domain.length > 253) return false;
  if (domain.includes(":") || domain.includes("/") || /\s/.test(domain)) return false;
  if (domain.startsWith("-") || domain.startsWith(".") || domain.endsWith(".")) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  if (labels.every((label) => /^\d+$/.test(label))) return false;
  if (
    !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(
      domain,
    )
  ) {
    return false;
  }
  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,}$/.test(tld)) return false;
  return !RESERVED_TLDS.has(tld);
}


export function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/\.$/, "").replace(/:\d+$/, "");
}

export function hostMatchesSite(host: string, siteDomain: string): boolean {
  const hostname = normalizeHost(host);
  const domain = normalizeHost(siteDomain);
  if (!hostname || !domain) return false;
  if (hostname === domain) return true;
  if (hostname === `www.${domain}` || domain === `www.${hostname}`) return true;
  return hostname.endsWith(`.${domain}`);
}

/**
 * Which side of the tenant boundary a page lives on. "site" is the registered domain (with www
 * and subdomains); "app" is anything else that the beacon binding let through, which is only
 * Signal's own origin serving the example page. Only site-scope pages may feed a site's
 * headline, breakdown, findings, and experiments.
 */
export type PageScope = "site" | "app";

export function pageScope(url: string, siteDomain: string): PageScope | null {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  return hostMatchesSite(host, siteDomain) ? "site" : "app";
}

function hostAllowedForBeacon(host: string, siteDomain: string, appOrigin?: string): boolean {
  if (hostMatchesSite(host, siteDomain)) return true;
  if (!appOrigin) return false;
  try {
    return normalizeHost(host) === new URL(appOrigin).hostname.toLowerCase();
  } catch {
    return false;
  }
}

export function beaconBoundToSite(opts: {
  url: string;
  origin: string | null;
  siteDomain: string;
  appOrigin?: string;
}): { ok: true } | { ok: false } {
  let urlHost: string;
  try {
    urlHost = new URL(opts.url).hostname;
  } catch {
    return { ok: false };
  }
  if (!hostAllowedForBeacon(urlHost, opts.siteDomain, opts.appOrigin)) {
    return { ok: false };
  }
  if (opts.origin) {
    try {
      const originHost = new URL(opts.origin).hostname;
      if (!hostAllowedForBeacon(originHost, opts.siteDomain, opts.appOrigin)) {
        return { ok: false };
      }
    } catch {
      return { ok: false };
    }
  }
  return { ok: true };
}

export function siteMayServe(site: { isActive: boolean }): boolean {
  return site.isActive;
}

export function registerDomainError(): string {
  return "Unable to register domain";
}

const DEFAULT_TRUSTED_PROXY_HOPS = 0;

/**
 * How many proxies in front of Signal append to X-Forwarded-For. Unset means none: a forged
 * header is then ignored and every caller shares one bucket. Production sets the real count.
 */
export function trustedProxyHops(env: Record<string, string | undefined> = process.env): number {
  const raw = env.TRUSTED_PROXY_HOPS;
  if (raw === undefined || raw === "") return DEFAULT_TRUSTED_PROXY_HOPS;
  const hops = Number(raw);
  return Number.isInteger(hops) && hops >= 0 ? hops : DEFAULT_TRUSTED_PROXY_HOPS;
}

/**
 * Client address for rate limiting. The leftmost X-Forwarded-For entry is written by the
 * caller and cannot be trusted, so the address is read from the right: with N trusted
 * proxies in front, the N-th entry from the end is the one the edge proxy appended.
 * Without a trusted proxy every caller shares one anonymous bucket.
 */
export function clientIp(headers: Headers, hops: number = trustedProxyHops()): string {
  if (hops <= 0) return "unknown";
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const entries = forwarded
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    const index = entries.length - hops;
    return index >= 0 ? entries[index] : "unknown";
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function requestIp(request: Request): string {
  return clientIp(request.headers);
}
