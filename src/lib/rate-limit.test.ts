import { describe, expect, it } from "vitest";
import { RATE_LIMIT_SWEEP_THRESHOLD, checkRateLimit, checkCompositeRateLimit, rateLimitBucketCount, resetRateLimits } from "@/lib/rate-limit";

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

describe("composite limiter", () => {
  it("blocks cross-key spam by counting a shared IP bucket", () => {
    resetRateLimits();
    const opts = { windowMs: 60_000, max: 3 };
    const ip = "ip:1.2.3.4";
    const kA = "key:a";
    const kB = "key:b";
    expect(checkCompositeRateLimit([ip, kA], opts).ok).toBe(true); // 1
    expect(checkCompositeRateLimit([ip, kA], opts).ok).toBe(true); // 2
    expect(checkCompositeRateLimit([ip, kB], opts).ok).toBe(true); // 3 via different key
    expect(checkCompositeRateLimit([ip, kA], opts).ok).toBe(false); // IP bucket full
    expect(checkCompositeRateLimit([ip, kB], opts).ok).toBe(false); // Still full even if key rotates
  });
});

describe("bucket eviction", () => {
  it("sweeps expired buckets once the map reaches the threshold", () => {
    resetRateLimits();
    const opts = { windowMs: 1_000, max: 1 };
    const t0 = 1_000_000;
    for (let i = 0; i < RATE_LIMIT_SWEEP_THRESHOLD; i += 1) checkRateLimit(`k${i}`, opts, t0);
    expect(rateLimitBucketCount()).toBe(RATE_LIMIT_SWEEP_THRESHOLD);
    checkRateLimit("fresh", opts, t0 + 5_000);
    expect(rateLimitBucketCount()).toBe(1);
    resetRateLimits();
  });

  it("keeps live buckets when sweeping", () => {
    resetRateLimits();
    const opts = { windowMs: 60_000, max: 1 };
    const t0 = 2_000_000;
    for (let i = 0; i < RATE_LIMIT_SWEEP_THRESHOLD; i += 1) checkRateLimit(`k${i}`, opts, t0);
    checkRateLimit("fresh", opts, t0 + 1);
    expect(rateLimitBucketCount()).toBe(RATE_LIMIT_SWEEP_THRESHOLD + 1);
    expect(checkRateLimit("k0", opts, t0 + 2).ok).toBe(false);
    resetRateLimits();
  });
});
