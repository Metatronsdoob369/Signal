type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function resetRateLimits(): void {
  buckets.clear();
}

export function checkRateLimit(
  key: string,
  opts: { windowMs: number; max: number },
): { ok: true } | { ok: false } {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now >= current.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }
  if (current.count >= opts.max) {
    return { ok: false };
  }
  current.count += 1;
  return { ok: true };
}
