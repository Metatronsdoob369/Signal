import { describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimits } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  it("allows up to max hits in the window then rejects", () => {
    resetRateLimits();
    const opts = { windowMs: 60_000, max: 3 };
    expect(checkRateLimit("token-a", opts).ok).toBe(true);
    expect(checkRateLimit("token-a", opts).ok).toBe(true);
    expect(checkRateLimit("token-a", opts).ok).toBe(true);
    expect(checkRateLimit("token-a", opts).ok).toBe(false);
  });

  it("isolates keys so one token cannot starve another", () => {
    resetRateLimits();
    const opts = { windowMs: 60_000, max: 1 };
    expect(checkRateLimit("a", opts).ok).toBe(true);
    expect(checkRateLimit("b", opts).ok).toBe(true);
    expect(checkRateLimit("a", opts).ok).toBe(false);
  });
});
