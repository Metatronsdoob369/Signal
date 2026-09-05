import { describe, expect, it } from "vitest";
import { allowedBeaconOrigin, corsHeaders } from "@/lib/cors";

describe("allowedBeaconOrigin", () => {
  it("never reflects an unmatched origin", () => {
    expect(allowedBeaconOrigin("https://evil.com", "example.com", "http://localhost:3000")).toBeNull();
  });

  it("allows the registered site origin", () => {
    expect(allowedBeaconOrigin("https://example.com", "example.com")).toBe("https://example.com");
    expect(allowedBeaconOrigin("https://www.example.com", "example.com")).toBe(
      "https://www.example.com",
    );
  });

  it("allows APP_ORIGIN for the local example page", () => {
    expect(allowedBeaconOrigin("http://localhost:3000", "example.com", "http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
  });

  it("does not fall back to *", () => {
    expect(allowedBeaconOrigin(null, "example.com")).toBeNull();
    expect(allowedBeaconOrigin("", "example.com")).toBeNull();
  });
});

describe("corsHeaders", () => {
  it("does not include GET on the beacon allow-list", () => {
    const headers = new Headers(corsHeaders("https://example.com"));
    expect(headers.get("Access-Control-Allow-Methods")).not.toMatch(/GET/i);
    expect(headers.get("Access-Control-Allow-Origin")).toBe("https://example.com");
  });

  it("can allow GET on the resolve allow-list", () => {
    const headers = new Headers(corsHeaders("https://example.com", "GET, OPTIONS"));
    expect(headers.get("Access-Control-Allow-Methods")).toMatch(/GET/);
  });
});
