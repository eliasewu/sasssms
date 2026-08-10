import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { pool } from "@/db";
import { parseAuditJson } from "@/lib/db-helpers";

// ═══════════════════════════════════════════════════════════════════════
//  Feature-toggle audit — every change to a tenant's per-feature toggle
//  (SMPP / HTTP API / RCS / Flash SMS / Voice OTP / OTT / Business API /
//  Email / Auto-Renew), who made it, and when.
//
//  Source: audit_log (entity_type = 'tenant_toggle'), written by the 0039
//  trigger whenever any audited toggle column actually changes. old_data /
//  new_data hold the column's snake_case name as the single key, e.g.
//  {"smpp_enabled": true}.
//
//  GET /api/super/toggle-audit?tenantId=123&limit=10
//    tenantId — optional, filter to one tenant
//    limit    — optional, clamp 1–50 (default 20)
// ═══════════════════════════════════════════════════════════════════════

export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const tenantIdParam = url.searchParams.get("tenantId");
  const tenantId = tenantIdParam ? parseInt(tenantIdParam) : null;
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "20") || 20, 1), 50);

  const client = await pool.connect();
  try {
    const params: unknown[] = [];
    let where = "a.entity_type = 'tenant_toggle'";
    if (tenantId) {
      params.push(tenantId);
      where += ` AND a.tenant_id = $${params.length}`;
    }
    params.push(limit);
    where += ` ORDER BY a.id DESC LIMIT $${params.length}`;

    const { rows } = await client.query(
      `SELECT a.id, a.action, a.new_data, a.changed_by, a.ip_address, a.created_at,
              t.company_name, t.email, t.id AS tenant_id
       FROM audit_log a
       LEFT JOIN tenants t ON a.tenant_id = t.id
       WHERE ${where}`,
      params
    );

    const entries = rows.map((r) => {
      const meta = parseAuditJson(r.new_data);
      const column = Object.keys(meta)[0] || null;
      return {
        id: r.id,
        tenantId: r.tenant_id,
        tenantName: r.company_name || "unknown",
        tenantEmail: r.email || null,
        column, // e.g. "smpp_enabled" (snake_case, matches the tenants column)
        enabled: column ? meta[column] === true : false,
        changedBy: r.changed_by || "unknown",
        ip: r.ip_address || null,
        at: r.created_at,
      };
    });

    return NextResponse.json({ entries });
  } catch (e) {
    console.error("toggle-audit error:", e);
    return NextResponse.json({ entries: [], error: (e as Error).message }, { status: 500 });
  } finally {
    client.release();
  }
}
