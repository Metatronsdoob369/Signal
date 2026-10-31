type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * In-memory rate limiter buckets per process. Limits reset when the server restarts
 * and do not coordinate across instances. If the deployment already includes a
 * shared store, consider moving these counters there; do not add paid infra here.
 *
 * Sweep expired buckets once the map grows past this, so unbounded keys cannot fill memory.
 */
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

/**
 * Composite limiter: checks all provided keys atomically. If any key is already at
 * limit, no counters are incremented and the call is rejected. Otherwise increments
 * all counters, preventing bypass by rotating identifiers.
 */
export function checkCompositeRateLimit(
  keys: string[],
  opts: { windowMs: number; max: number },
  now = Date.now(),
): { ok: true } | { ok: false } {
  // First pass: determine which buckets would be new or exceeded.
  let wouldReject = false;
  const snapshots: Array<{ key: string; next: Bucket }> = [];
  for (const key of keys) {
    const current = buckets.get(key);
    if (!current || now >= current.resetAt) {
      snapshots.push({ key, next: { count: 1, resetAt: now + opts.windowMs } });
      continue;
    }
    if (current.count >= opts.max) {
      wouldReject = true;
      break;
    }
    snapshots.push({ key, next: { count: current.count + 1, resetAt: current.resetAt } });
  }
  if (wouldReject) return { ok: false };
  if (buckets.size >= RATE_LIMIT_SWEEP_THRESHOLD) sweep(now);
  for (const { key, next } of snapshots) {
    buckets.set(key, next);
  }
  return { ok: true };
}
