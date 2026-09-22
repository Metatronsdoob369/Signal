import { describe, expect, it } from "vitest";
import { classifyReferrerHost } from "./referrers";

describe("classifyReferrerHost", () => {
  it("classifies empty as direct", () => {
    expect(classifyReferrerHost("")).toBe("direct");
  });
  it("classifies AI answer engines", () => {
    expect(classifyReferrerHost("chat.openai.com")).toBe("ai");
    expect(classifyReferrerHost("www.perplexity.ai")).toBe("ai");
    expect(classifyReferrerHost("claude.ai")).toBe("ai");
    expect(classifyReferrerHost("copilot.microsoft.com")).toBe("ai");
  });
  it("classifies search", () => {
    expect(classifyReferrerHost("google.com")).toBe("search");
    expect(classifyReferrerHost("www.google.co.uk")).toBe("search");
    expect(classifyReferrerHost("bing.com")).toBe("search");
    expect(classifyReferrerHost("duckduckgo.com")).toBe("search");
    expect(classifyReferrerHost("search.brave.com")).toBe("search");
  });
  it("classifies social", () => {
    expect(classifyReferrerHost("twitter.com")).toBe("social");
    expect(classifyReferrerHost("x.com")).toBe("social");
    expect(classifyReferrerHost("t.co")).toBe("social");
    expect(classifyReferrerHost("www.linkedin.com")).toBe("social");
  });
  it("falls back to other", () => {
    expect(classifyReferrerHost("news.ycombinator.com")).toBe("other");
  });
});

