import { NextResponse } from "next/server";
import { pool } from "@/db";
import {
  hashToken,
  ACCESS_COOKIE_MAX_AGE,
  REFRESH_COOKIE_MAX_AGE,
  TENANT_ACCESS_COOKIE,
  TENANT_REFRESH_COOKIE,
  SUPER_ACCESS_COOKIE,
  SUPER_REFRESH_COOKIE,
} from "@/lib/auth";

/**
 * Server-side lifecycle store for the access/refresh token model.
 *
 * `auth_sessions` lives in the PUBLIC schema (like `login_sessions`) and holds
 * one row per logged-in device/browser. We store ONLY hashes of the tokens:
 *  - `access_token_hash` — hash of the CURRENT short-lived access JWT. The
 *    proxy looks this up on every request to enforce immediate logout.
 *  - `refresh_token_hash` — hash of the CURRENT opaque refresh token. Rotated
 *    (single-use) on every refresh so a captured refresh token is rejected the
 *    moment it's replayed.
 *  - `revoked_at` — set by logout; any token belonging to a revoked session is
 *    dead on the next request.
 *
 * All functions fail OPEN where appropriate (e.g. a transient DB error during
 * the revocation check must never lock a valid user out — the short access-TTL
 * still bounds the exposure).
 */

const COOKIE_BASE = { httpOnly: true, secure: true, sameSite: "lax" as const };

/**
 * Set the access + refresh cookies on a login/refresh response. The refresh
 * cookie is path-scoped to the auth endpoints (not /api/tenant/*) so it is
 * never sent with ordinary data requests — only to /refresh and /logout.
 */
export function setSessionCookies(
  response: NextResponse,
  kind: "tenant" | "super",
  accessToken: string,
  refreshToken: string,
  secure = true
): void {
  const base = { ...COOKIE_BASE, secure };
  if (kind === "tenant") {
    response.cookies.set(TENANT_ACCESS_COOKIE, accessToken, {
      ...base, maxAge: ACCESS_COOKIE_MAX_AGE, path: "/",
    });
    response.cookies.set(TENANT_REFRESH_COOKIE, refreshToken, {
      ...base, maxAge: REFRESH_COOKIE_MAX_AGE, path: "/api/auth",
    });
  } else {
    response.cookies.set(SUPER_ACCESS_COOKIE, accessToken, {
      ...base, maxAge: ACCESS_COOKIE_MAX_AGE, path: "/",
    });
    response.cookies.set(SUPER_REFRESH_COOKIE, refreshToken, {
      ...base, maxAge: REFRESH_COOKIE_MAX_AGE, path: "/api/super/auth",
    });
  }
}

/** Clear both cookies at every plausible path (maxAge=0 deletes them). */
export function clearSessionCookies(response: NextResponse, kind: "tenant" | "super"): void {
  const names = kind === "tenant"
    ? [TENANT_ACCESS_COOKIE, TENANT_REFRESH_COOKIE]
    : [SUPER_ACCESS_COOKIE, SUPER_REFRESH_COOKIE];
  for (const name of names) {
    for (const path of ["/", "/api/auth", "/api/super/auth"]) {
      response.cookies.set(name, "", { ...COOKIE_BASE, maxAge: 0, path });
    }
  }
}

let tableEnsured = false;

/** Idempotent table bootstrap — mirrors drizzle-kit push so the proxy check
 *  works even before the next deploy's schema push runs. */
export async function ensureAuthSessionsTable(): Promise<void> {
  if (tableEnsured) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id SERIAL PRIMARY KEY,
        user_type VARCHAR(20) NOT NULL,
        user_id INTEGER NOT NULL,
        email VARCHAR(255) NOT NULL,
        access_token_hash VARCHAR(100),
        refresh_token_hash VARCHAR(100),
        revoked_at TIMESTAMP,
        last_seen_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS auth_sessions_refresh_hash_idx ON auth_sessions (refresh_token_hash)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS auth_sessions_access_hash_idx ON auth_sessions (access_token_hash)`);
    tableEnsured = true;
  } catch (e) {
    // Never throw — table creation is best-effort; login/refresh handle absence.
    console.error("[session-store] ensureAuthSessionsTable failed:", (e as Error).message);
  }
}

export interface AuthSessionInfo {
  userType: "tenant" | "super";
  userId: number;
  email: string;
}

/** Create a fresh session row for a successful login/signup. */
export async function createAuthSession(params: {
  userType: "tenant" | "super";
  userId: number;
  email: string;
  accessToken: string;
  refreshToken: string;
}): Promise<void> {
  await ensureAuthSessionsTable();
  try {
    await pool.query(
      `INSERT INTO auth_sessions
         (user_type, user_id, email, access_token_hash, refresh_token_hash)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        params.userType,
        params.userId,
        params.email,
        hashToken(params.accessToken),
        hashToken(params.refreshToken),
      ]
    );
  } catch (e) {
    // Login must never fail because session bookkeeping is unavailable.
    console.error("[session-store] createAuthSession failed:", (e as Error).message);
  }
}

/**
 * Verify + rotate a refresh token (single-use). On success the old refresh
 * hash is replaced with `newRefreshToken` and the access hash is updated to
 * `newAccessToken`. Returns the session identity, or null if the token is
 * unknown/revoked (replay or logout).
 */
/**
 * Non-destructive lookup of a refresh token's session identity (used by the
 * refresh route to re-fetch fresh user data before atomically rotating).
 * Returns null for unknown/revoked tokens.
 */
export async function lookupRefreshSession(rawRefreshToken: string): Promise<AuthSessionInfo | null> {
  await ensureAuthSessionsTable();
  try {
    const { rows } = await pool.query(
      `SELECT user_type, user_id, email FROM auth_sessions
        WHERE refresh_token_hash = $1 AND revoked_at IS NULL LIMIT 1`,
      [hashToken(rawRefreshToken)]
    );
    if (!rows.length) return null;
    const r = rows[0];
    return { userType: r.user_type, userId: r.user_id, email: r.email };
  } catch (e) {
    console.error("[session-store] lookupRefreshSession failed:", (e as Error).message);
    return null;
  }
}

export async function rotateRefreshSession(params: {
  rawRefreshToken: string;
  newAccessToken: string;
  newRefreshToken: string;
}): Promise<AuthSessionInfo | null> {
  await ensureAuthSessionsTable();
  const refreshHash = hashToken(params.rawRefreshToken);
  try {
    const { rows } = await pool.query(
      `UPDATE auth_sessions
          SET refresh_token_hash = $1,
              access_token_hash = $2,
              last_seen_at = NOW(),
              updated_at = NOW()
        WHERE refresh_token_hash = $3
          AND revoked_at IS NULL
        RETURNING user_type, user_id, email`,
      [hashToken(params.newRefreshToken), hashToken(params.newAccessToken), refreshHash]
    );
    if (!rows.length) return null;
    const r = rows[0];
    return { userType: r.user_type, userId: r.user_id, email: r.email };
  } catch (e) {
    console.error("[session-store] rotateRefreshSession failed:", (e as Error).message);
    return null;
  }
}

/** Revoke the session that owns this access token (used by logout). */
export async function revokeByAccessToken(rawAccessToken: string): Promise<void> {
  await ensureAuthSessionsTable();
  try {
    await pool.query(
      `UPDATE auth_sessions SET revoked_at = NOW(), updated_at = NOW()
        WHERE access_token_hash = $1 AND revoked_at IS NULL`,
      [hashToken(rawAccessToken)]
    );
  } catch (e) {
    console.error("[session-store] revokeByAccessToken failed:", (e as Error).message);
  }
}

/** Revoke the session that owns this refresh token (used by logout). */
export async function revokeByRefreshToken(rawRefreshToken: string): Promise<void> {
  await ensureAuthSessionsTable();
  try {
    await pool.query(
      `UPDATE auth_sessions SET revoked_at = NOW(), updated_at = NOW()
        WHERE refresh_token_hash = $1 AND revoked_at IS NULL`,
      [hashToken(rawRefreshToken)]
    );
  } catch (e) {
    console.error("[session-store] revokeByRefreshToken failed:", (e as Error).message);
  }
}

/**
 * The per-request kill check used by the proxy. Returns true only when the
 * token belongs to a session that has been explicitly revoked (logout). A
 * missing row (special tokens like APK share links, or a token minted before
 * this table existed) is treated as NOT revoked — fail-open, bounded by the
 * 15-minute access TTL.
 */
export async function isAccessTokenRevoked(rawAccessToken: string): Promise<boolean> {
  await ensureAuthSessionsTable();
  try {
    const { rows } = await pool.query(
      `SELECT revoked_at FROM auth_sessions WHERE access_token_hash = $1 LIMIT 1`,
      [hashToken(rawAccessToken)]
    );
    return rows.length > 0 && rows[0].revoked_at != null;
  } catch (e) {
    // Fail-open: never lock users out over a transient DB error.
    console.error("[session-store] isAccessTokenRevoked failed:", (e as Error).message);
    return false;
  }
}
