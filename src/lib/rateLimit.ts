// Best-effort, per-instance fixed-window rate limiter. Blunts slug enumeration
// on the public routes (CLAUDE.md "Access Rules"). In-memory only: state is
// per-process and resets on restart — sufficient for the single-container
// deployment; swap for a shared store (e.g. Redis) if the app is ever scaled out.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 60;
const MAX_TRACKED_KEYS = 10_000;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Returns true if the request is allowed, false if the caller is over the limit.
export function rateLimit(key: string, now: number = Date.now()): boolean {
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    // Enforce a HARD cap so a flood of distinct keys (e.g. rotated/spoofed IPs)
    // cannot grow the map without bound (memory-exhaustion DoS). Drop expired
    // first, then evict oldest-inserted entries until strictly under the cap.
    if (buckets.size >= MAX_TRACKED_KEYS) {
      pruneExpired(now);
      evictOldestUntilUnderCap();
    }
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  bucket.count += 1;
  return true;
}

function pruneExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) {
      buckets.delete(key);
    }
  }
}

function evictOldestUntilUnderCap(): void {
  while (buckets.size >= MAX_TRACKED_KEYS) {
    const oldest = buckets.keys().next().value;
    if (oldest === undefined) {
      break;
    }
    buckets.delete(oldest);
  }
}

// Test-only helpers: inspect/reset shared state between cases.
export function __resetRateLimitState(): void {
  buckets.clear();
}

export function __rateLimitSize(): number {
  return buckets.size;
}
