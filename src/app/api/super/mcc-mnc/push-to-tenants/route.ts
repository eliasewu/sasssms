import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { pool } from "@/db";

/**
 * POST — Push all MCC/MNC entries from the global database into active tenant's
 * client_rates and supplier_rates tables. Only inserts new entries (skips duplicates).
 *
 * Body (optional):
 *   { tenantIds?: number[] }  — push only to these specific tenant IDs.
 *   Omit tenantIds to push to ALL active tenants.
 *
 * Auth: Requires super admin session (cookie) or Bearer token in Authorization header.
 *
 * cURL examples:
 *   # Push to all active tenants
 *   curl -X POST https://net2app.com/api/super/mcc-mnc/push-to-tenants \
 *     -H "Authorization: Bearer <your-super-admin-jwt>"
 *
 *   # Push to specific tenants
 *   curl -X POST https://net2app.com/api/super/mcc-mnc/push-to-tenants \
 *     -H "Authorization: Bearer <your-super-admin-jwt>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"tenantIds":[1,3,5]}'
 *
 * To get your JWT token, extract the "super_admin_token" cookie value from your
 * browser session after logging into the super dashboard.
 */
export async function POST(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized — valid super admin session or Bearer token required" }, { status: 401 });
  }

  // Parse optional tenantIds from body
  let targetTenantIds: number[] | undefined;
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (body.tenantIds && Array.isArray(body.tenantIds) && body.tenantIds.length > 0) {
      targetTenantIds = body.tenantIds.filter((id: unknown) => typeof id === "number" && Number.isFinite(id));
      if (targetTenantIds.length === 0) {
        return NextResponse.json({ error: "No valid tenant IDs provided" }, { status: 400 });
      }
    }
  }

  const client = await pool.connect();

  try {
    // Reset to public schema first
    await client.query("SET search_path TO public");

    // 1. Fetch all MCC/MNC entries
    const { rows: mccEntries } = await client.query(
      "SELECT mcc, mnc, mccmnc, country_code, country_name, network_name FROM mcc_mnc_database ORDER BY country_name, network_name"
    );

    if (mccEntries.length === 0) {
      return NextResponse.json({ error: "No MCC/MNC entries in the database" }, { status: 400 });
    }

    // 2. Get tenants — filter by tenantIds if provided, otherwise all active
    let tenantQuery: string;
    let tenantParams: number[] = [];
    if (targetTenantIds && targetTenantIds.length > 0) {
      const placeholders = targetTenantIds.map((_, i) => `$${i + 1}`).join(", ");
      tenantQuery = `SELECT id, schema_name FROM tenants WHERE is_active = true AND id IN (${placeholders})`;
      tenantParams = targetTenantIds;
    } else {
      tenantQuery = "SELECT id, schema_name FROM tenants WHERE is_active = true";
    }
    const { rows: tenants } = await client.query(tenantQuery, tenantParams);

    if (tenants.length === 0) {
      return NextResponse.json({ error: targetTenantIds ? "None of the specified tenants are active" : "No active tenants found" }, { status: 400 });
    }

    let totalInserted = 0;
    let totalSkipped = 0;

    // 3. For each tenant, push to client_rates and supplier_rates
    for (const tenant of tenants) {
      const schemaName = tenant.schema_name;

      try {
        // Run all queries for this tenant in a single transaction
        await client.query("BEGIN");
        await client.query("SET search_path TO public"); // Start clean
        await client.query(`SET search_path TO "${schemaName}"`);

        // Push to client_rates using batch WHERE NOT EXISTS to skip duplicates
        for (const entry of mccEntries) {
          const { rowCount } = await client.query(
            `INSERT INTO client_rates (client_id, country_code, mcc, mnc, mccmnc, operator_name, rate)
             SELECT $1, $2, $3, $4, $3 || LPAD(COALESCE($4,''), 3, '0'), $5, $6
             WHERE NOT EXISTS (
               SELECT 1 FROM client_rates
               WHERE country_code = $2 AND mcc = $3 AND COALESCE(mnc,'') = $7
             )`,
            [-1, entry.country_code, entry.mcc, entry.mnc || null, entry.network_name || null, "0.00025", entry.mnc || ""]
          );
          if (rowCount && rowCount > 0) totalInserted++;
          else totalSkipped++;
        }

        // Push to supplier_rates
        for (const entry of mccEntries) {
          const { rowCount } = await client.query(
            `INSERT INTO supplier_rates (supplier_id, country_code, mcc, mnc, mccmnc, operator_name, cost)
             SELECT $1, $2, $3, $4, $3 || LPAD(COALESCE($4,''), 3, '0'), $5, $6
             WHERE NOT EXISTS (
               SELECT 1 FROM supplier_rates
               WHERE country_code = $2 AND mcc = $3 AND COALESCE(mnc,'') = $7
             )`,
            [-1, entry.country_code, entry.mcc, entry.mnc || null, entry.network_name || null, "0.00020", entry.mnc || ""]
          );
          if (rowCount && rowCount > 0) totalInserted++;
          else totalSkipped++;
        }

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        console.error(`Push to tenant ${schemaName} failed:`, e);
      } finally {
        // Always reset search_path after tenant processing
        await client.query("SET search_path TO public");
      }
    }

    return NextResponse.json({
      success: true,
      tenantCount: tenants.length,
      mccEntries: mccEntries.length,
      inserted: totalInserted,
      skipped: totalSkipped,
      message: `Pushed ${totalInserted} entries to ${tenants.length} tenants (${totalSkipped} skipped)`,
    });
  } catch (error) {
    console.error("MCC push-to-tenants error:", error);
    return NextResponse.json({ error: "Push failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
