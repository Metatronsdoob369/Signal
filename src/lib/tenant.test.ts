import { describe, expect, it } from "vitest";
import { createSiteSchema } from "@/contracts";
import {
  beaconBoundToSite,
  hostMatchesSite,
  isValidHostname,
  registerDomainError,
  siteMayServe,
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
