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

// ── Consecutive-failure login guard (brute-force lockout) ──

interface FailureEntry {
  count: number;
  lockedUntil: number;
}

/**
 * Login brute-force guard: blocks a key (account / account+IP) after N
 * CONSECUTIVE failed attempts, then unlocks after a lockout window. A single
 * successful login resets the counter.
 *
 * Unlike RateLimiter (fixed window per IP), this is a per-account consecutive
 * failure lockout — it protects a specific login from password guessing even
 * when the attacker rotates IPs.
 */
export class LoginGuard {
  private failures = new Map<string, FailureEntry>();
  private maxAttempts: number;
  private lockoutMs: number;

  constructor(maxAttempts: number, lockoutMs: number) {
    this.maxAttempts = maxAttempts;
    this.lockoutMs = lockoutMs;
  }

  /** Sweep expired entries so the map never grows unboundedly. */
  private gc(): void {
    const now = Date.now();
    for (const [key, entry] of this.failures) {
      if (now > entry.lockedUntil + this.lockoutMs) {
        this.failures.delete(key);
      }
    }
  }

  /**
   * Register a failed attempt. Returns the remaining attempts before lockout
   * (0 = locked) plus the lockout duration in ms if this attempt triggered it.
   * Attempts made while already locked do NOT extend the lockout.
   */
  registerFailure(key: string): { remaining: number; lockedMs: number } {
    this.gc();
    const now = Date.now();
    const entry = this.failures.get(key);

    // Already locked out — report it without extending the window.
    if (entry && now <= entry.lockedUntil) {
      return { remaining: 0, lockedMs: entry.lockedUntil - now };
    }

    // Fresh failure streak (or lockout expired) — start/restart the counter.
    if (!entry) {
      this.failures.set(key, { count: 1, lockedUntil: now });
      return { remaining: this.maxAttempts - 1, lockedMs: 0 };
    }

    entry.count++;
    if (entry.count >= this.maxAttempts) {
      // Locked out
      entry.lockedUntil = now + this.lockoutMs;
      return { remaining: 0, lockedMs: this.lockoutMs };
    }

    return { remaining: this.maxAttempts - entry.count, lockedMs: 0 };
  }

  /**
   * Check whether a key is currently locked out. Returns ms until unlock
   * (0 = not locked).
   */
  lockedMs(key: string): number {
    this.gc();
    const entry = this.failures.get(key);
    if (!entry) return 0;
    return Math.max(0, entry.lockedUntil - Date.now());
  }

  /** Clear the failure streak on a successful login. */
  reset(key: string): void {
    this.failures.delete(key);
  }
}

// ── Specific limiters ──

/** Auth endpoints: 10 attempts per IP per minute */
export const authLimiter = new RateLimiter(10, 60_000);

/** Login brute-force: 5 consecutive failures per account → 15 min lockout */
export const loginGuard = new LoginGuard(5, 15 * 60_000);

/** Super-admin login brute-force: 5 consecutive failures → 15 min lockout */
export const superLoginGuard = new LoginGuard(5, 15 * 60_000);

/** Webmail login: 5 consecutive failures → 1 minute lockout (kept at prior config) */
export const webmailLoginGuard = new LoginGuard(5, 60_000);

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
