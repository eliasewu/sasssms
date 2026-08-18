import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { auditLog } from "@/lib/db-helpers";
import { pool } from "@/db";
import { getGatewayApiKey, rotateGatewayApiKey } from "@/lib/gateway-rest-auth";

export const dynamic = "force-dynamic";

// Short action labels — audit_log.action is VARCHAR(20), so the longer
// "ROTATE_GATEWAY_API_KEY" would silently overflow and never be recorded.
const ACTION_CREATED = "GATEWAY_KEY_CREATED";
const ACTION_ROTATED = "GATEWAY_KEY_ROTATED";

/**
 * View a supplier's current gateway API key (the long-lived device credential
 * used by Android/REST gateway devices instead of the supplier password),
 * plus the rotation history from the public audit log (who/when/ip).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supplierId = parseInt(id);
  if (!Number.isFinite(supplierId)) return NextResponse.json({ error: "Invalid supplier id" }, { status: 400 });

  const exists = await tenantQuery(
    tenant.schemaName,
    "SELECT id FROM suppliers WHERE id = $1 AND deleted_at IS NULL",
    [supplierId]
  );
  if (exists.rows.length === 0) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const apiKey = await getGatewayApiKey(tenant.schemaName, supplierId);

  // Rotation history — audit_log lives in the PUBLIC schema (rows written by
  // auditLog()), so scope by tenant_id + entity to keep it to this supplier.
  let history: { id: number; action: string; changedBy: string | null; ip: string | null; at: string }[] = [];
  try {
    const { rows } = await pool.query(
      `SELECT id, action, changed_by, ip_address, created_at
       FROM audit_log
       WHERE tenant_id = $1 AND entity_type = 'suppliers' AND entity_id = $2
         AND action IN ($3, $4)
       ORDER BY id DESC
       LIMIT 25`,
      [tenant.tenantId, supplierId, ACTION_CREATED, ACTION_ROTATED]
    );
    history = rows.map((r) => ({
      id: r.id,
      action: r.action,
      changedBy: r.changed_by || null,
      ip: r.ip_address || null,
      at: r.created_at,
    }));
  } catch (e) {
    // Best-effort — never fail the key view over an audit query.
    console.error("[gateway-api-key] history query failed:", (e as Error).message);
  }

  return NextResponse.json({ apiKey, history });
}

/**
 * Rotate a supplier's gateway API key. Returns the new key; the old key stops
 * working immediately, so connected devices must be updated with the new one.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const supplierId = parseInt(id);
  if (!Number.isFinite(supplierId)) return NextResponse.json({ error: "Invalid supplier id" }, { status: 400 });

  const exists = await tenantQuery(
    tenant.schemaName,
    "SELECT id, name, gateway_api_key FROM suppliers WHERE id = $1 AND deleted_at IS NULL",
    [supplierId]
  );
  if (exists.rows.length === 0) return NextResponse.json({ error: "Supplier not found" }, { status: 404 });

  const hadKey = Boolean(exists.rows[0].gateway_api_key);
  const apiKey = await rotateGatewayApiKey(tenant.schemaName, supplierId);
  if (!apiKey) return NextResponse.json({ error: "Failed to rotate API key" }, { status: 500 });

  await auditLog(
    "suppliers",
    supplierId,
    hadKey ? ACTION_ROTATED : ACTION_CREATED,
    tenant.email,
    { name: exists.rows[0].name },
    { kind: hadKey ? "rotated" : "created" },
    tenant.tenantId
  );

  return NextResponse.json({ apiKey });
}
