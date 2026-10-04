type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Limiteur mémoire simple (process local). Suffisant pour freiner brute-force / DoS CPU. */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  if (current.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: Math.max(0, current.resetAt - now) };
  }
  current.count += 1;
  return { ok: true, remaining: limit - current.count, retryAfterMs: 0 };
}

export function clientKey(request: Request, scope: string) {
  const forwarded = process.env.TRUST_PROXY === "1"
    ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    : null;
  const host = forwarded || "local";
  return `${scope}:${host}`;
}

/** Visible des tests uniquement. */
export function resetRateLimitsForTests() {
  buckets.clear();
}
