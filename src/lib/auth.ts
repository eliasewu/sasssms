import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const INSECURE_FALLBACK = "net2app-sms-platform-secret-key-2024";
const JWT_SECRET = process.env.JWT_SECRET || INSECURE_FALLBACK;
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === INSECURE_FALLBACK) {
  // Fail loudly in production — a guessable/known JWT secret lets anyone forge
  // tenant and super-admin tokens. The app still boots with a dev fallback so
  // local development isn't blocked, but the operator is alerted.
  console.error("[SECURITY] JWT_SECRET is missing or set to the public fallback value. Set a strong random JWT_SECRET in .env immediately.");
}

let jwtFingerprintLogged = false;

/**
 * Log a short SHA-256 fingerprint of the ACTIVE JWT secret at startup, so an
 * operator can verify the running process is using the same secret as .env
 * (the #1 cause of "no token found"/401 is a drift between the two). The
 * fingerprint is safe to log — it can't be reversed to recover the secret.
 */
export function logJwtSecretFingerprint(): void {
  if (jwtFingerprintLogged) return;
  jwtFingerprintLogged = true;
  const fp = crypto.createHash("sha256").update(JWT_SECRET).digest("hex").slice(0, 16);
  const source = !process.env.JWT_SECRET
    ? "MISSING (using fallback)"
    : JWT_SECRET === INSECURE_FALLBACK
    ? "INSECURE FALLBACK"
    : "env";
  console.log(`[AUTH] JWT_SECRET fingerprint: ${fp} (source: ${source})`);
}

export interface TenantToken { tenantId: number; email: string; schemaName: string; companyName: string; impersonatedBy?: string; }
export interface SuperAdminToken { adminId: number; email: string; isSuper: boolean; }

// ── Access / refresh token model ──
// Access tokens are SHORT-LIVED (15 min) to shrink the window an intercepted
// token is usable for. The refresh token keeps the user "stayed in" without
// re-entering their password, is stored server-side as a hash only, and is
// rotated (single-use) on every refresh. Logout revokes the session so the
// access token is rejected on the very next request (see src/proxy.ts).
export const ACCESS_TOKEN_TTL = "15m";
export const ACCESS_COOKIE_MAX_AGE = 15 * 60; // 15 minutes (seconds)
// "Until logout": no server-side expiry — only logout revokes it. The cookie
// just needs a long maxAge so the session survives browser restarts.
export const REFRESH_COOKIE_MAX_AGE = 10 * 365 * 24 * 60 * 60; // 10 years

export const TENANT_ACCESS_COOKIE = "tenant_token";
export const TENANT_REFRESH_COOKIE = "tenant_refresh";
export const SUPER_ACCESS_COOKIE = "super_admin_token";
export const SUPER_REFRESH_COOKIE = "super_admin_refresh";

/** SHA-256 hex of a token — what we store/lookup server-side (irreversible). */
export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Random opaque refresh token (96 hex chars). Only its hash is persisted. */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("hex");
}

/**
 * Extract the RAW access token from a request (cookie or Authorization header)
 * without verifying it — used by the proxy for the per-request revocation
 * lookup (sha256 → auth_sessions). Returns null when no token is present.
 */
export function extractRawAccessToken(request: Request): string | null {
  const cookie = request.headers.get("cookie") || "";
  const mTenant = cookie.match(/tenant_token=([^;]+)/);
  if (mTenant && mTenant[1]) return mTenant[1];
  const mSuper = cookie.match(/super_admin_token=([^;]+)/);
  if (mSuper && mSuper[1]) return mSuper[1];
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const t = authHeader.replace(/^Bearer\s+/i, "");
    if (t) return t;
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Derive REST API key from SMPP credentials (sha256: first 32 hex chars) */
export function deriveApiKey(username: string, password: string): string {
  return crypto.createHash("sha256")
    .update(username + ":" + password)
    .digest("hex")
    .slice(0, 32);
}

export function createToken(payload: TenantToken | SuperAdminToken): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL }); // short-lived access token
}

/** Short-lived (15 min) token for super-admin tenant impersonation. Carries
 *  impersonatedBy so audit trails can attribute the access to the admin. */
export function createImpersonationToken(payload: TenantToken): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
}

/** Generate a token that never expires — used for shareable APK download links */
export function createNonExpiringToken(payload: TenantToken | SuperAdminToken): string {
  return jwt.sign(payload, JWT_SECRET); // no expiresIn = never expires
}

export function verifyToken(token: string): TenantToken | SuperAdminToken | null {
  try { return jwt.verify(token, JWT_SECRET) as TenantToken | SuperAdminToken; }
  catch { return null; }
}

/**
 * Short-lived (30 min) token embedded in the per-tenant 3proxy installer
 * scripts. Lets the installer script on the residential machine register the
 * freshly-created proxy in the tenant's dashboard WITHOUT a browser session:
 * the token itself carries the tenant id/schema + the generated proxy
 * credentials, so the register endpoint never trusts script-supplied creds.
 */
export interface ProxyRegisterToken {
  scope: "proxy-register";
  tenantId: number;
  schemaName: string;
  username: string;
  password: string;
  port: number;
}

export function createProxyRegisterToken(payload: ProxyRegisterToken): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30m" });
}

export function verifyProxyRegisterToken(token: string): ProxyRegisterToken | null {
  try {
    const d = jwt.verify(token, JWT_SECRET) as ProxyRegisterToken;
    // Require credentials too — so a malformed token can never overwrite an
    // existing (host, port) row with empty username/password in the register route.
    return d && d.scope === "proxy-register" && d.tenantId && d.schemaName && d.username && d.password ? d : null;
  }
  catch { return null; }
}

export function getTenantFromRequest(request: Request): TenantToken | null {
  // 1. Try cookie (browser-based auth)
  const cookie = request.headers.get("cookie");
  if (cookie) {
    const m = cookie.match(/tenant_token=([^;]+)/);
    if (m) { const d = verifyToken(m[1]); if (d && "tenantId" in d) return d; }
  }
  // 2. Try Authorization: Bearer <token> header (Android app / mobile / cURL)
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token) {
      const d = verifyToken(token);
      if (d && "tenantId" in d) return d;
    }
  }
  return null;
}

export function getSuperAdminFromRequest(request: Request): SuperAdminToken | null {
  // 1. Try cookie (browser-based auth)
  const cookie = request.headers.get("cookie");
  if (cookie) {
    const m = cookie.match(/super_admin_token=([^;]+)/);
    if (m) { const d = verifyToken(m[1]); if (d && "isSuper" in d && d.isSuper) return d; }
  }
  // 2. Try Authorization: Bearer <token> header (script/cron/cURL-based auth)
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token) {
      const d = verifyToken(token);
      if (d && "isSuper" in d && d.isSuper) return d;
    }
  }
  return null;
}
