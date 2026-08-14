import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { db, pool } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * PUT /api/super/http-api-config — push HTTP API settings to tenants.
 *
 * Body:
 *   { action: "seed-all" }                         → all active tenants
 *   { action: "seed-selected", tenantIds: [1,2,3] } → specific tenants
 *   settings: {
 *     enableHttpApi?: boolean   (enable/disable HTTP API on each client)
 *     maxTps?: number           (rate limit — messages/second per client)
 *     webhookUrl?: string       (DLR callback endpoint)
 *     httpApiKey?: string       (API credential — applied to all active clients)
 *   }
 *
 * Only the provided settings are written — undefined fields leave tenant
 * values untouched. Applies to every active client row in each tenant schema.
 */
export async function PUT(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const action = body.action;
  const tenantIds: number[] = body.tenantIds || [];
  const s = body.settings || {};

  if (action !== "seed-all" && action !== "seed-selected") {
    return NextResponse.json({ error: "Invalid action. Use 'seed-all' or 'seed-selected'" }, { status: 400 });
  }

  const hasSettings = s.enableHttpApi !== undefined || s.maxTps !== undefined ||
    s.webhookUrl !== undefined || s.httpApiKey !== undefined;
  if (!hasSettings) {
    return NextResponse.json({ error: "No settings provided. Send enableHttpApi, maxTps, webhookUrl, or httpApiKey." }, { status: 400 });
  }

  if (action === "seed-selected" && tenantIds.length === 0) {
    return NextResponse.json({ error: "Select at least one tenant" }, { status: 400 });
  }

  let allTenants = await db.select({ id: tenants.id, schemaName: tenants.schemaName, companyName: tenants.companyName })
    .from(tenants)
    .where(eq(tenants.isActive, true));

  const targetTenants = action === "seed-selected"
    ? allTenants.filter(t => tenantIds.includes(t.id))
    : allTenants;

  // Build the SET fragment from provided settings only.
  const sets: string[] = [];
  const params: unknown[] = [];
  if (s.enableHttpApi !== undefined) { params.push(!!s.enableHttpApi); sets.push(`enable_http_api = $${params.length}`); }
  if (s.maxTps !== undefined) { params.push(s.maxTps); sets.push(`max_tps = $${params.length}`); }
  if (s.webhookUrl !== undefined) { params.push(s.webhookUrl); sets.push(`webhook_url = $${params.length}`); }
  if (s.httpApiKey !== undefined) { params.push(s.httpApiKey); sets.push(`http_api_key = $${params.length}`); }
  const setSql = sets.join(", ");

  let updatedClients = 0;
  let updatedTenants = 0;
  const errors: string[] = [];
  const client = await pool.connect();
  try {
    for (const tenant of targetTenants) {
      try {
        const r = await client.query(
          `UPDATE "${tenant.schemaName}".clients SET ${setSql}, updated_at = NOW() WHERE is_active = true`
        , params);
        if (r.rowCount && r.rowCount > 0) {
          updatedClients += r.rowCount;
          updatedTenants++;
        }
      } catch (e) {
        errors.push(`${tenant.companyName}: ${(e as Error).message}`);
      }
    }
  } finally {
    client.release();
  }

  const message = errors.length > 0
    ? `Updated ${updatedTenants}/${targetTenants.length} tenant(s) (${updatedClients} clients, ${errors.length} errors)`
    : `Updated ${updatedTenants}/${targetTenants.length} tenant(s) (${updatedClients} clients)`;

  return NextResponse.json({
    success: true,
    message,
    updatedTenants,
    updatedClients,
    totalTenants: targetTenants.length,
    errorCount: errors.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
