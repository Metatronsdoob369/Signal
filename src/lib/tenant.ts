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
  return /^[a-z]{2,}$/.test(tld);
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

export function requestIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}
