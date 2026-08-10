import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { pool } from "@/db";
import { invalidateMmsForwardCache } from "@/lib/mms-forward";

/**
 * GET /api/tenant/mms-settings — current MMS-forwarding flag for this tenant.
 * PUT  /api/tenant/mms-settings — { enabled: boolean } to enable/disable
 *       forwarding [MMS] placeholder MOs (WAP_PUSH notifications from the
 *       Android gateway) into the tenant's sms_inbox.
 */
export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      "SELECT mms_forward_enabled FROM tenants WHERE id = $1",
      [tenant.tenantId]
    );
    return NextResponse.json({ enabled: rows[0]?.mms_forward_enabled !== false });
  } catch {
    return NextResponse.json({ error: "Failed to read setting" }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function PUT(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { enabled?: unknown };
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled (boolean) is required" }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query(
      "UPDATE tenants SET mms_forward_enabled = $1, updated_at = NOW() WHERE id = $2",
      [body.enabled, tenant.tenantId]
    );
    invalidateMmsForwardCache(tenant.tenantId);
    return NextResponse.json({ enabled: body.enabled });
  } catch {
    return NextResponse.json({ error: "Failed to save setting" }, { status: 500 });
  } finally {
    client.release();
  }
}
