/**
 * Rate lookup helpers — replace the legacy rate_per_sms (clients) and
 * cost_per_sms (suppliers) columns with per-country/MCC lookups from
 * the client_rates and supplier_rates tables.
 *
 * Uses prefix matching on the destination phone number against
 * country_code, with longest-prefix-wins specificity.
 *
 * Accepts an optional existing PoolClient for connection reuse (e.g.,
 * in batch loops like campaign sending) to avoid pool exhaustion.
 */
import { pool } from "@/db";
import type { PoolClient } from "pg";

const DEFAULT_CLIENT_RATE = 0.00010;
const DEFAULT_SUPPLIER_COST = 0.00004;

/**
 * Look up the per-SMS rate for a client based on the destination phone number.
 * Uses longest-prefix match against country_code in client_rates.
 * Falls back to DEFAULT_CLIENT_RATE if no match is found.
 */
export async function lookupClientRate(
  destination: string,
  clientId: number,
  schemaName: string,
  existingClient?: PoolClient
): Promise<number> {
  // Strip leading + for consistent prefix matching (country codes are stored without +)
  const cleaned = destination.replace(/^\+/, "");
  const dbClient = existingClient || await pool.connect();
  const shouldRelease = !existingClient;
  try {
    if (!existingClient) await dbClient.query(`SET search_path TO "${schemaName}"`);
    const { rows } = await dbClient.query(
      `SELECT rate::numeric FROM client_rates
       WHERE client_id = $1 AND is_active = true AND $2 LIKE country_code || '%'
       ORDER BY LENGTH(country_code) DESC LIMIT 1`,
      [clientId, cleaned]
    );
    if (rows.length > 0) {
      return parseFloat(rows[0].rate);
    }
    return DEFAULT_CLIENT_RATE;
  } catch {
    return DEFAULT_CLIENT_RATE;
  } finally {
    if (shouldRelease) {
      await dbClient.query("SET search_path TO public");
      dbClient.release();
    }
  }
}

/**
 * Look up the per-SMS cost for a supplier based on the destination phone number.
 * Uses longest-prefix match against country_code in supplier_rates.
 * Falls back to DEFAULT_SUPPLIER_COST if no match is found.
 */
export async function lookupSupplierCost(
  destination: string,
  supplierId: number,
  schemaName: string,
  existingClient?: PoolClient
): Promise<number> {
  // Strip leading + for consistent prefix matching (country codes are stored without +)
  const cleaned = destination.replace(/^\+/, "");
  const dbClient = existingClient || await pool.connect();
  const shouldRelease = !existingClient;
  try {
    if (!existingClient) await dbClient.query(`SET search_path TO "${schemaName}"`);
    const { rows } = await dbClient.query(
      `SELECT cost::numeric FROM supplier_rates
       WHERE supplier_id = $1 AND is_active = true AND $2 LIKE country_code || '%'
       ORDER BY LENGTH(country_code) DESC LIMIT 1`,
      [supplierId, cleaned]
    );
    if (rows.length > 0) {
      return parseFloat(rows[0].cost);
    }
    return DEFAULT_SUPPLIER_COST;
  } catch {
    return DEFAULT_SUPPLIER_COST;
  } finally {
    if (shouldRelease) {
      await dbClient.query("SET search_path TO public");
      dbClient.release();
    }
  }
}
