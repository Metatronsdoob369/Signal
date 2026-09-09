type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Sweep expired buckets once the map grows past this, so unbounded keys cannot fill memory. */
export const RATE_LIMIT_SWEEP_THRESHOLD = 10_000;

export function resetRateLimits(): void {
  buckets.clear();
}

export function rateLimitBucketCount(): number {
  return buckets.size;
}

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export function checkRateLimit(
  key: string,
  opts: { windowMs: number; max: number },
  now = Date.now(),
): { ok: true } | { ok: false } {
  const current = buckets.get(key);
  if (!current || now >= current.resetAt) {
    if (buckets.size >= RATE_LIMIT_SWEEP_THRESHOLD) sweep(now);
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }
  if (current.count >= opts.max) {
    return { ok: false };
  }
  current.count += 1;
  return { ok: true };
}
