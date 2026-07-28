/**
 * In-memory rate limiter for auth endpoints.
 * Protects against brute-force and credential stuffing attacks.
 */

interface Bucket {
  count: number;
  windowStart: number;
}

class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /** Run garbage collection on stale buckets */
  private gc(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.windowStart > this.windowMs) {
        this.buckets.delete(key);
      }
    }
  }

  /**
   * Check if the given key (IP) is rate-limited.
   * Cleans stale entries inline and returns false if allowed, true if limited.
   */
  check(key: string): boolean {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now - bucket.windowStart > this.windowMs) {
      // Stale or new — reset window
      this.buckets.set(key, { count: 1, windowStart: now });
      return false; // allowed
    }

    bucket.count++;
    return bucket.count > this.maxRequests;
  }

  /** Get remaining requests for a key (for debugging). */
  remaining(key: string): number {
    const bucket = this.buckets.get(key);
    if (!bucket) return this.maxRequests;
    const now = Date.now();
    if (now - bucket.windowStart > this.windowMs) {
      this.buckets.delete(key);
      return this.maxRequests;
    }
    return Math.max(0, this.maxRequests - bucket.count);
  }
}

// ── Specific limiters ──

/** Auth endpoints: 10 attempts per IP per minute */
export const authLimiter = new RateLimiter(10, 60_000);

/** Registration: 3 per IP per hour (prevent mass account creation) */
export const registerLimiter = new RateLimiter(3, 3_600_000);

/** General API: 100 requests per IP per minute */
export const apiLimiter = new RateLimiter(100, 60_000);

/** Forgot password: 3 attempts per IP per 15 minutes */
export const forgotLimiter = new RateLimiter(3, 900_000);

/** Tawk.to chat persistence: 30 messages per IP per minute */
export const tawkLimiter = new RateLimiter(30, 60_000);

/**
 * Extract the client IP from request headers.
 * Respects Cloudflare's CF-Connecting-IP and standard X-Forwarded-For.
 */
export function getClientIp(request: Request): string {
  // Cloudflare header (most reliable)
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  // Standard proxy header
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  // Direct connection
  const remoteAddr = (request as any).socket?.remoteAddress;
  if (remoteAddr) return remoteAddr;

  return "127.0.0.1";
}
