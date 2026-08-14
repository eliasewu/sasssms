import type { Pool } from "pg";
import { padMnc } from "./mcc-lookup-client";

/**
 * Single global MCC/MNC entry change to propagate to tenants.
 * Mirrors the fields the MCC/MNC routes accept.
 */
export interface MccMncSyncEntry {
  mcc: string;
  mnc: string | null;
  countryCode: string;
  networkName: string | null;
}

export type MccMncSyncAction = "create" | "update" | "delete";

export interface MccMncSyncStats {
  /** Tenants successfully synced */
  tenants: number;
  /** Tenants that failed to sync (logged; global change still succeeds) */
  failed: number;
  /** Rows added to client_rates + supplier_rates (shared defaults) */
  inserted: number;
  /** Rows updated in client_rates + supplier_rates (shared defaults) */
  updated: number;
  /** Rows removed from client_rates + supplier_rates (shared defaults) */
  deleted: number;
}

/**
 * Propagate a change to the global mcc_mnc_database into every active tenant's
 * shared-default rate rows (client_id = -1 in client_rates, supplier_id = -1 in
 * supplier_rates). The MCC/MNC write routes and the nightly CSV sync script call
 * this so changes to the global database reach existing tenants without a
 * manual "Push to Tenants" run.
 *
 * The pool is passed in (rather than imported) so the standalone
 * scripts/sync-mccmnc.ts cron job can use its own pg.Pool configuration.
 *
 * - "create": INSERT the entry unless the tenant already has it (dedup on the
 *   zero-padded MNC key, so "3" and "003" are the same network).
 * - "update": UPDATE matching shared-default rows with the new country/network
 *   values. If the MCC/MNC key itself changed (oldKey differs), the old rows
 *   are removed first and the entry re-inserted under the new key.
 * - "delete": DELETE matching shared-default rows.
 *
 * Per-tenant failures are caught and logged — a single broken schema never
 * aborts the rest of the sync.
 */
export async function syncMccMncToTenants(
  pool: Pool,
  entry: MccMncSyncEntry,
  action: MccMncSyncAction,
  oldKey?: { mcc: string; mnc: string | null }
): Promise<MccMncSyncStats> {
  const client = await pool.connect();
  const stats: MccMncSyncStats = { tenants: 0, failed: 0, inserted: 0, updated: 0, deleted: 0 };
  try {
    await client.query("SET search_path TO public");
    // Only sync to schemas that physically exist on THIS server — the tenants
    // table is replicated across the fleet, but each server hosts only a subset
    // of tenant schemas. Writing into a non-local schema would fail (and the
    // nightly cron would error-spam for every entry on every foreign tenant).
    const { rows: tenants } = await client.query(
      `SELECT t.schema_name FROM tenants t
       WHERE t.is_active = true
         AND EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = t.schema_name)`
    );
    if (tenants.length === 0) return stats;

    // Tenant rate tables have country_code NOT NULL — store an empty string
    // instead of failing the whole tenant when the global row lacks a code.
    const countryCode = entry.countryCode || "";
    const mncPadded = padMnc(entry.mnc) || null;
    const keyChanged =
      action === "update" &&
      !!oldKey &&
      (oldKey.mcc !== entry.mcc || padMnc(oldKey.mnc) !== padMnc(entry.mnc));

    for (const tenant of tenants) {
      const schemaName = tenant.schema_name as string;
      try {
        await client.query("BEGIN");
        await client.query(`SET search_path TO "${schemaName}"`);

        // ── Delete phase (plain delete, or update where the key changed) ──
        if (action === "delete" || keyChanged) {
          const deleteKey = keyChanged ? oldKey! : entry;
          const deleteMnc = padMnc(deleteKey.mnc) || null;
          const delClient = await client.query(
            `DELETE FROM client_rates
             WHERE client_id = -1 AND mcc = $1::text
               AND LPAD(COALESCE(mnc,''), 3, '0') = LPAD(COALESCE($2::text,''), 3, '0')`,
            [deleteKey.mcc, deleteMnc]
          );
          const delSupplier = await client.query(
            `DELETE FROM supplier_rates
             WHERE supplier_id = -1 AND mcc = $1::text
               AND LPAD(COALESCE(mnc,''), 3, '0') = LPAD(COALESCE($2::text,''), 3, '0')`,
            [deleteKey.mcc, deleteMnc]
          );
          stats.deleted += (delClient.rowCount || 0) + (delSupplier.rowCount || 0);
        }

        // ── Insert phase (create, or update where the key changed) ──
        if (action === "create" || keyChanged) {
          const insClient = await client.query(
            `INSERT INTO client_rates (client_id, country_code, mcc, mnc, mccmnc, operator_name, rate)
             SELECT -1, $1::text, $2::text, $3::text, $2::text || LPAD(COALESCE($3::text,''), 3, '0'), $4::text, 0.00025
             WHERE NOT EXISTS (
               SELECT 1 FROM client_rates
               WHERE country_code = $1 AND mcc = $2
                 AND LPAD(COALESCE(mnc,''), 3, '0') = LPAD(COALESCE($3,''), 3, '0')
             )`,
            [countryCode, entry.mcc, mncPadded, entry.networkName]
          );
          const insSupplier = await client.query(
            `INSERT INTO supplier_rates (supplier_id, country_code, mcc, mnc, mccmnc, operator_name, cost)
             SELECT -1, $1::text, $2::text, $3::text, $2::text || LPAD(COALESCE($3::text,''), 3, '0'), $4::text, 0.00020
             WHERE NOT EXISTS (
               SELECT 1 FROM supplier_rates
               WHERE country_code = $1 AND mcc = $2
                 AND LPAD(COALESCE(mnc,''), 3, '0') = LPAD(COALESCE($3,''), 3, '0')
             )`,
            [countryCode, entry.mcc, mncPadded, entry.networkName]
          );
          stats.inserted += (insClient.rowCount || 0) + (insSupplier.rowCount || 0);
        } else if (action === "update") {
          // Same key — update country/network on the matching shared-default rows.
          const oldMcc = oldKey ? oldKey.mcc : entry.mcc;
          const oldMncPadded = padMnc(oldKey ? oldKey.mnc : entry.mnc) || null;
          const updClient = await client.query(
            `UPDATE client_rates
             SET country_code = $1::text, mcc = $2::text, mnc = $3::text,
                 mccmnc = $2::text || LPAD(COALESCE($3::text,''), 3, '0'),
                 operator_name = $4::text, updated_at = NOW()
             WHERE client_id = -1 AND mcc = $5::text
               AND LPAD(COALESCE(mnc,''), 3, '0') = LPAD(COALESCE($6::text,''), 3, '0')`,
            [countryCode, entry.mcc, mncPadded, entry.networkName, oldMcc, oldMncPadded]
          );
          const updSupplier = await client.query(
            `UPDATE supplier_rates
             SET country_code = $1::text, mcc = $2::text, mnc = $3::text,
                 mccmnc = $2::text || LPAD(COALESCE($3::text,''), 3, '0'),
                 operator_name = $4::text, updated_at = NOW()
             WHERE supplier_id = -1 AND mcc = $5::text
               AND LPAD(COALESCE(mnc,''), 3, '0') = LPAD(COALESCE($6::text,''), 3, '0')`,
            [countryCode, entry.mcc, mncPadded, entry.networkName, oldMcc, oldMncPadded]
          );
          stats.updated += (updClient.rowCount || 0) + (updSupplier.rowCount || 0);
        }

        await client.query("COMMIT");
        stats.tenants++;
      } catch (e) {
        await client.query("ROLLBACK");
        stats.failed++;
        console.error(`MCC/MNC sync to tenant ${schemaName} failed:`, e);
      } finally {
        // Always reset search_path after tenant processing
        await client.query("SET search_path TO public");
      }
    }

    return stats;
  } catch (error) {
    console.error("MCC/MNC sync error:", error);
    return stats;
  } finally {
    client.release();
  }
}
