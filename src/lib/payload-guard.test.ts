import { describe, expect, it } from "vitest";
import { beaconPayloadSchema } from "@/contracts";
import {
  FORBIDDEN_CONTENT_KEYS,
  MAX_BEACON_BYTES,
  assertBeaconSize,
  assertNoPageContent,
  parseBeaconPayload,
} from "@/lib/payload-guard";

describe("assertBeaconSize", () => {
  it("rejects bodies over the v0.1 cap", () => {
    const result = assertBeaconSize("x".repeat(MAX_BEACON_BYTES + 1));
    expect(result.ok).toBe(false);
  });

  it("accepts a body at the cap", () => {
    expect(assertBeaconSize("x".repeat(MAX_BEACON_BYTES)).ok).toBe(true);
  });
});

describe("assertNoPageContent", () => {
  it("rejects raw HTML and page-body fields used for cloud inference", () => {
    for (const key of FORBIDDEN_CONTENT_KEYS) {
      expect(assertNoPageContent({ url: "https://example.com/", [key]: "<p>hi</p>" }).ok).toBe(
        false,
      );
    }
  });

  it("rejects HTML documents smuggled in an allowed string", () => {
    expect(
      assertNoPageContent({
        url: "https://example.com/",
        metadata: { title: "<!DOCTYPE html><html><body>full page</body></html>" },
      }).ok,
    ).toBe(false);
  });

  it("allows the structured beacon shape", () => {
    expect(assertNoPageContent({ url: "https://example.com/", metadata: { title: "Hello" } }).ok).toBe(
      true,
    );
  });
});

describe("parseBeaconPayload", () => {
  it("rejects unknown keys instead of stripping them", () => {
    const result = parseBeaconPayload({
      url: "https://example.com/page",
      html: "<article>secret</article>",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts a minimal valid payload", () => {
    const result = parseBeaconPayload({ url: "https://example.com/page" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.url).toBe("https://example.com/page");
    }
  });

  it("caps key length", () => {
    const result = parseBeaconPayload({
      url: "https://example.com/page",
      key: "a".repeat(200),
    });
    expect(result.ok).toBe(false);
  });
});

describe("beaconPayloadSchema", () => {
  it("rejects unknown keys at the top level", () => {
    const result = beaconPayloadSchema.safeParse({
      url: "https://example.com/page",
      bodyText: "full page copy for a model",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an experiment beacon with variant events", () => {
    const result = beaconPayloadSchema.safeParse({
      url: "https://example.com/page",
      intent: "experiment",
      variantId: "11111111-1111-4111-8111-111111111111",
      events: [
        { type: "impression", value: 1 },
        { type: "engage", value: 0.72 },
        { type: "vital", metric: "lcp", value: 2100 },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.intent).toBe("experiment");
      expect(result.data.events).toHaveLength(3);
    }
  });

  it("rejects an unknown experiment event type", () => {
    const result = beaconPayloadSchema.safeParse({
      url: "https://example.com/page",
      intent: "experiment",
      events: [{ type: "click", value: 1 }],
    });
    expect(result.success).toBe(false);
  });
});
