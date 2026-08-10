import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { pool } from "@/db";
import { parseAuditJson } from "@/lib/db-helpers";

// ═══════════════════════════════════════════════════════════════════════
//  Installer download audit — which tenant downloaded a 3proxy installer
//  (and whether it embedded the Tailscale auto-connect auth key).
//
//  Source: audit_log (entity_type = 'proxy_installer'), written fire-and-
//  forget by /api/tenant/proxy-config/download.
//
//  GET /api/super/installer-audit?limit=30
// ═══════════════════════════════════════════════════════════════════════

export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get("limit") || "30") || 30, 1), 100);

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT a.id, a.action, a.new_data, a.ip_address, a.created_at,
              t.company_name, t.email, t.id AS tenant_id
       FROM audit_log a
       LEFT JOIN tenants t ON a.tenant_id = t.id
       WHERE a.entity_type = 'proxy_installer'
       ORDER BY a.id DESC
       LIMIT $1`,
      [limit]
    );

    const entries = rows.map((r) => {
      const meta = parseAuditJson(r.new_data);
      return {
        id: r.id,
        tenantId: r.tenant_id,
        tenantName: r.company_name || "unknown",
        tenantEmail: r.email || null,
        os: String(meta.os || "unknown"),
        filename: String(meta.filename || ""),
        embeddedAuthKey: meta.embeddedAuthKey === true,
        ip: r.ip_address || null,
        at: r.created_at,
      };
    });

    return NextResponse.json({ entries });
  } catch (e) {
    console.error("installer-audit error:", e);
    return NextResponse.json({ entries: [], error: (e as Error).message }, { status: 500 });
  } finally {
    client.release();
  }
}
