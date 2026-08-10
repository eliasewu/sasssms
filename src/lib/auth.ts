import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "net2app-sms-platform-secret-key-2024";

export interface TenantToken { tenantId: number; email: string; schemaName: string; companyName: string; }
export interface SuperAdminToken { adminId: number; email: string; isSuper: boolean; }

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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" }); // 30 days for both
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
