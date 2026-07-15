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

export function verifyToken(token: string): TenantToken | SuperAdminToken | null {
  try { return jwt.verify(token, JWT_SECRET) as TenantToken | SuperAdminToken; }
  catch { return null; }
}

export function getTenantFromRequest(request: Request): TenantToken | null {
  const cookie = request.headers.get("cookie");
  if (cookie) {
    const m = cookie.match(/tenant_token=([^;]+)/);
    if (m) { const d = verifyToken(m[1]); if (d && "tenantId" in d) return d; }
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
