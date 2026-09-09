import { describe, expect, it } from "vitest";
import { evaluateRobots, parseRobotsTxt, rootAccessFor } from "@/lib/crawl/robots";

const SAMPLE = `
# policy
User-agent: GPTBot
User-agent: CCBot
Disallow: /

User-agent: PerplexityBot
Disallow: /private/
Allow: /

User-agent: OAI-SearchBot
Disallow:

User-agent: *
Disallow: /admin/
Sitemap: https://example.com/sitemap.xml
`;

describe("parseRobotsTxt", () => {
  it("groups consecutive user-agent lines and collects sitemaps", () => {
    const parsed = parseRobotsTxt(SAMPLE);
    expect(parsed.groups).toHaveLength(4);
    expect(parsed.groups[0].agents).toEqual(["gptbot", "ccbot"]);
    expect(parsed.groups[0].rules).toEqual([{ type: "disallow", path: "/" }]);
    expect(parsed.sitemaps).toEqual(["https://example.com/sitemap.xml"]);
  });

  it("ignores comments, blank lines and unknown directives", () => {
    const parsed = parseRobotsTxt("Crawl-delay: 10\n# nothing\nUser-agent: x\nDisallow: /a # trailing\n");
    expect(parsed.groups[0].rules).toEqual([{ type: "disallow", path: "/a" }]);
  });
});

describe("rootAccessFor", () => {
  const parsed = parseRobotsTxt(SAMPLE);

  it("blocks agents in a Disallow: / group, case-insensitively", () => {
    expect(rootAccessFor(parsed, "gptbot")).toBe("disallow");
    expect(rootAccessFor(parsed, "CCBot")).toBe("disallow");
  });

  it("does not treat a path-specific disallow as a root block", () => {
    expect(rootAccessFor(parsed, "PerplexityBot")).toBe("allow");
  });

  it("treats an empty Disallow as allow-all", () => {
    expect(rootAccessFor(parsed, "OAI-SearchBot")).toBe("allow");
  });

  it("falls back to the wildcard group and then to unspecified", () => {
    expect(rootAccessFor(parsed, "ClaudeBot")).toBe("allow");
    expect(rootAccessFor(parseRobotsTxt("User-agent: GPTBot\nDisallow: /"), "ClaudeBot")).toBe("unspecified");
  });

  it("prefers the most specific matching agent token", () => {
    const text = "User-agent: Claude\nDisallow: /\n\nUser-agent: Claude-User\nAllow: /\n";
    expect(rootAccessFor(parseRobotsTxt(text), "Claude-User")).toBe("allow");
    expect(rootAccessFor(parseRobotsTxt(text), "ClaudeBot")).toBe("disallow");
  });

  it("lets Allow win a tie with Disallow of equal length", () => {
    const text = "User-agent: *\nDisallow: /\nAllow: /\n";
    expect(rootAccessFor(parseRobotsTxt(text), "anything")).toBe("allow");
  });

  it("handles wildcard and anchored patterns", () => {
    expect(rootAccessFor(parseRobotsTxt("User-agent: *\nDisallow: /*"), "x")).toBe("disallow");
    expect(rootAccessFor(parseRobotsTxt("User-agent: *\nDisallow: /$"), "x")).toBe("disallow");
    expect(rootAccessFor(parseRobotsTxt("User-agent: *\nDisallow: /blog$"), "x")).toBe("allow");
  });
});

describe("evaluateRobots", () => {
  it("returns per-token access, sitemap flag and disallow-all", () => {
    const result = evaluateRobots(SAMPLE, ["GPTBot", "PerplexityBot", "Googlebot"]);
    expect(result.bots).toEqual({ GPTBot: "disallow", PerplexityBot: "allow", Googlebot: "allow" });
    expect(result.sitemapDeclared).toBe(true);
    expect(result.disallowAll).toBe(false);
  });

  it("detects a site that disallows everything", () => {
    const result = evaluateRobots("User-agent: *\nDisallow: /", ["Googlebot"]);
    expect(result.disallowAll).toBe(true);
    expect(result.bots.Googlebot).toBe("disallow");
  });
});
