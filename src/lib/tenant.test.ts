import { describe, expect, it } from "vitest";
import { createSiteSchema } from "@/contracts";
import {
  beaconBoundToSite,
  clientIp,
  hostMatchesSite,
  isValidHostname,
  registerDomainError,
  siteMayServe,
  trustedProxyHops,
  pageScope,
} from "@/lib/tenant";

describe("isValidHostname", () => {
  it("accepts a registrable domain", () => {
    expect(isValidHostname("example.com")).toBe(true);
    expect(isValidHostname("docs.example.co.uk")).toBe(true);
  });

  it("rejects localhost, IPs, and junk", () => {
    expect(isValidHostname("localhost")).toBe(false);
    expect(isValidHostname("127.0.0.1")).toBe(false);
    expect(isValidHostname("not a domain")).toBe(false);
    expect(isValidHostname("example")).toBe(false);
  });

  it("rejects reserved and private-network suffixes the server must never fetch", () => {
    for (const domain of [
      "api.localhost",
      "printer.local",
      "vault.internal",
      "nas.lan",
      "router.home",
      "wiki.intranet",
      "db.corp",
      "site.test",
      "site.invalid",
      "site.example",
      "hidden.onion",
    ]) {
      expect(isValidHostname(domain)).toBe(false);
    }
    expect(isValidHostname("example.com")).toBe(true);
    expect(isValidHostname("localhost.com")).toBe(true);
  });
});

describe("createSiteSchema", () => {
  it("rejects invalid hostnames after normalize", () => {
    expect(createSiteSchema.safeParse({ domain: "localhost" }).success).toBe(false);
    expect(createSiteSchema.safeParse({ domain: "not a domain" }).success).toBe(false);
  });

  it("strips protocol and path", () => {
    expect(createSiteSchema.parse({ domain: "https://Example.com/path" }).domain).toBe("example.com");
  });
});

describe("hostMatchesSite", () => {
  it("matches apex and www", () => {
    expect(hostMatchesSite("example.com", "example.com")).toBe(true);
    expect(hostMatchesSite("www.example.com", "example.com")).toBe(true);
  });

  it("matches a subdomain of the registered domain", () => {
    expect(hostMatchesSite("docs.example.com", "example.com")).toBe(true);
  });

  it("rejects a different registrable domain", () => {
    expect(hostMatchesSite("evil.com", "example.com")).toBe(false);
    expect(hostMatchesSite("example.com.evil.com", "example.com")).toBe(false);
    expect(hostMatchesSite("notexample.com", "example.com")).toBe(false);
  });
});

describe("beaconBoundToSite", () => {
  it("rejects a beacon whose URL is not the registered domain", () => {
    const result = beaconBoundToSite({
      url: "https://evil.example/phish",
      origin: "https://evil.example",
      siteDomain: "client.com",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a beacon from the registered domain", () => {
    const result = beaconBoundToSite({
      url: "https://client.com/pricing",
      origin: "https://client.com",
      siteDomain: "client.com",
    });
    expect(result.ok).toBe(true);
  });

  it("allows the app origin so the example client page can beacon", () => {
    const result = beaconBoundToSite({
      url: "http://localhost:3000/example-client-page.html",
      origin: "http://localhost:3000",
      siteDomain: "client.com",
      appOrigin: "http://localhost:3000",
    });
    expect(result.ok).toBe(true);
  });
});

describe("siteMayServe", () => {
  it("revokes ingest and dashboard when the site is inactive", () => {
    expect(siteMayServe({ isActive: false })).toBe(false);
    expect(siteMayServe({ isActive: true })).toBe(true);
  });
});

describe("registerDomainError", () => {
  it("does not distinguish taken domains from invalid ones", () => {
    expect(registerDomainError()).toBe("Unable to register domain");
  });
});

describe("clientIp", () => {
  const headers = (forwarded?: string, realIp?: string) => {
    const h = new Headers();
    if (forwarded !== undefined) h.set("x-forwarded-for", forwarded);
    if (realIp !== undefined) h.set("x-real-ip", realIp);
    return h;
  };

  it("reads the entry appended by the nearest trusted proxy, not the caller's first entry", () => {
    expect(clientIp(headers("1.2.3.4"), 1)).toBe("1.2.3.4");
    expect(clientIp(headers("spoofed, 1.2.3.4"), 1)).toBe("1.2.3.4");
    expect(clientIp(headers("spoofed, 1.2.3.4, 10.0.0.9"), 2)).toBe("1.2.3.4");
  });

  it("does not trust a header shorter than the proxy chain", () => {
    expect(clientIp(headers("1.2.3.4"), 2)).toBe("unknown");
    expect(clientIp(headers(""), 1)).toBe("unknown");
  });

  it("uses one shared bucket when no proxy is trusted", () => {
    expect(clientIp(headers("1.2.3.4"), 0)).toBe("unknown");
    expect(clientIp(headers(undefined, "1.2.3.4"), 0)).toBe("unknown");
  });

  it("falls back to x-real-ip behind a trusted proxy", () => {
    expect(clientIp(headers(undefined, "9.9.9.9"), 1)).toBe("9.9.9.9");
    expect(clientIp(headers(), 1)).toBe("unknown");
  });
});

describe("trustedProxyHops", () => {
  it("defaults to zero, trusting nothing until configured, and rejects junk", () => {
    expect(trustedProxyHops({})).toBe(0);
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: "" })).toBe(0);
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: "0" })).toBe(0);
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: "3" })).toBe(3);
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: "-1" })).toBe(0);
    expect(trustedProxyHops({ TRUSTED_PROXY_HOPS: "many" })).toBe(0);
  });
});

describe("pageScope", () => {
  it("puts pages on the registered domain, including www and subdomains, in site scope", () => {
    expect(pageScope("https://cosineautonomous.com/", "cosineautonomous.com")).toBe("site");
    expect(pageScope("https://www.cosineautonomous.com/about", "cosineautonomous.com")).toBe("site");
    expect(pageScope("https://docs.cosineautonomous.com/", "cosineautonomous.com")).toBe("site");
  });

  it("puts Signal's own example page in app scope", () => {
    expect(pageScope("http://localhost:3010/example-client-page.html?key=abc", "cosineautonomous.com")).toBe("app");
    expect(pageScope("https://signal.example.net/example-client-page.html", "cosineautonomous.com")).toBe("app");
  });

  it("returns null for a URL it cannot parse", () => {
    expect(pageScope("not a url", "cosineautonomous.com")).toBeNull();
    expect(pageScope("", "cosineautonomous.com")).toBeNull();
  });
});
