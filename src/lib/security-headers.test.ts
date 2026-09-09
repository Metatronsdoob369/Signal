import { describe, expect, it } from "vitest";
import nextConfig, { contentSecurityPolicy, noIndexHeaders, securityHeaders } from "../../next.config";

type HeaderRule = { source: string; headers: { key: string; value: string }[] };

describe("security headers", () => {
  it("locks the baseline response headers", () => {
    const byKey = new Map(securityHeaders.map((header) => [header.key, header.value]));
    expect(byKey.get("X-Content-Type-Options")).toBe("nosniff");
    expect(byKey.get("X-Frame-Options")).toBe("DENY");
    expect(byKey.get("Referrer-Policy")).toBe("no-referrer");
    expect(byKey.get("Strict-Transport-Security")).toMatch(/^max-age=\d{7,}; includeSubDomains$/);
    expect(byKey.get("Content-Security-Policy")).toBe(contentSecurityPolicy);
  });

  it("keeps the content security policy closed where it matters", () => {
    const directives = new Map(
      contentSecurityPolicy.split("; ").map((directive) => {
        const [name, ...values] = directive.split(" ");
        return [name, values.join(" ")];
      }),
    );
    expect(directives.get("default-src")).toBe("'self'");
    expect(directives.get("object-src")).toBe("'none'");
    expect(directives.get("base-uri")).toBe("'self'");
    expect(directives.get("form-action")).toBe("'self'");
    expect(directives.get("frame-ancestors")).toBe("'none'");
    expect(directives.get("connect-src")).toBe("'self'");
    expect(directives.get("script-src")).not.toMatch(/https?:|\*/);
  });

  it("marks dashboards and API responses non-indexable", async () => {
    const rules = (await nextConfig.headers?.()) as HeaderRule[];
    const has = (source: string, key: string) =>
      rules.some((rule) => rule.source === source && rule.headers.some((header) => header.key === key));
    expect(has("/:path*", "Content-Security-Policy")).toBe(true);
    expect(has("/dashboard/:path*", "X-Robots-Tag")).toBe(true);
    expect(has("/dashboard/:path*", "Cache-Control")).toBe(true);
    expect(has("/api/:path*", "X-Robots-Tag")).toBe(true);
    expect(noIndexHeaders[0].value).toBe("noindex, nofollow");
  });
});
