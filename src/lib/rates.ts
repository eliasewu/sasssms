/**
 * Rate lookup helpers — prefix matching on destination phone number
 * against numeric country_code in client_rates / supplier_rates.
 *
 * Handles international (880...), local (018...), and +prefixed (+880...) formats
 * by trying the destination as-is, stripping prefixes, and — as a last resort —
 * prepending available country codes to resolve local numbers.
 */
import { pool } from "@/db";
import type { PoolClient } from "pg";

const DEFAULT_CLIENT_RATE = 0.00010;
const DEFAULT_SUPPLIER_COST = 0.00004;

export interface MccMncEnrichment {
  mcc: string;
  mnc: string;
  countryName: string;
  networkName: string;
}

/** Whitelist for table/col names — prevents SQL injection via interpolation */
const ALLOWED_TABLES = new Set(["client_rates", "supplier_rates"]);
const ALLOWED_RATE_COLS = new Set(["rate", "cost"]);
const ALLOWED_ID_COLS = new Set(["client_id", "supplier_id"]);

function validateTableCol(table: string, rateCol: string, idCol: string): void {
  if (!ALLOWED_TABLES.has(table)) throw new Error(`Invalid rate table: ${table}`);
  if (!ALLOWED_RATE_COLS.has(rateCol)) throw new Error(`Invalid rate column: ${rateCol}`);
  if (!ALLOWED_ID_COLS.has(idCol)) throw new Error(`Invalid id column: ${idCol}`);
}

/**
 * Look up the per-SMS rate for a client based on the destination phone number.
 */
export async function lookupClientRate(
  destination: string,
  clientId: number,
  schemaName: string,
  existingClient?: PoolClient
): Promise<number> {
  const dbClient = existingClient || await pool.connect();
  const shouldRelease = !existingClient;
  try {
    if (!existingClient) await dbClient.query(`SET search_path TO "${schemaName}"`);
    const rate = await matchRate(dbClient, "client_rates", "rate", "client_id", clientId, destination);
    return rate ?? DEFAULT_CLIENT_RATE;
  } catch (err) {
    console.error("[rates] Client rate lookup error:", err);
    return DEFAULT_CLIENT_RATE;
  } finally {
    if (shouldRelease) { await dbClient.query("SET search_path TO public"); dbClient.release(); }
  }
}

/**
 * Look up the per-SMS cost for a supplier based on the destination phone number.
 */
export async function lookupSupplierCost(
  destination: string,
  supplierId: number,
  schemaName: string,
  existingClient?: PoolClient
): Promise<number> {
  const dbClient = existingClient || await pool.connect();
  const shouldRelease = !existingClient;
  try {
    if (!existingClient) await dbClient.query(`SET search_path TO "${schemaName}"`);
    const rate = await matchRate(dbClient, "supplier_rates", "cost", "supplier_id", supplierId, destination);
    return rate ?? DEFAULT_SUPPLIER_COST;
  } catch (err) {
    console.error("[rates] Supplier cost lookup error:", err);
    return DEFAULT_SUPPLIER_COST;
  } finally {
    if (shouldRelease) { await dbClient.query("SET search_path TO public"); dbClient.release(); }
  }
}

/**
 * Try to match a destination number against rate table entries.
 * Strategy: try international → +prefixed → local (strip 0, prepend country codes).
 * Uses a single query with ALL candidate variants via unnest() to avoid N+1.
 */
async function matchRate(
  dbClient: PoolClient,
  table: string,
  rateCol: string,
  idCol: string,
  id: number,
  destination: string
): Promise<number | null> {
  validateTableCol(table, rateCol, idCol);

  // Build candidate destination strings (deduplicated)
  const candidates = new Set<string>();
  candidates.add(destination);                         // 1) as-is: +8801867877441 or 8801867877441

  const noPlus = destination.replace(/^\+/, "");
  if (noPlus !== destination) candidates.add(noPlus);  // 2) strip +

  const local = destination.replace(/^0+/, "");
  if (local !== destination) {
    candidates.add(local);                             // 3) strip leading 0s

    // 4) Fetch all country codes and prepend them to the stripped local number
    const { rows: codes } = await dbClient.query(
      `SELECT DISTINCT country_code FROM ${table}
       WHERE ${idCol} = $1 AND is_active = true AND LENGTH(country_code) >= 2`,
      [id]
    );
    for (const row of codes) {
      const cc = row.country_code as string;
      if (!cc) continue;
      candidates.add(cc + local);
    }
  }

  // Run ONE query with all candidates via unnest
  const candidateArr = [...candidates];
  if (candidateArr.length === 0) return null;

  const { rows } = await dbClient.query(
    `SELECT ${rateCol}::numeric as rate FROM ${table}
     WHERE ${idCol} = $1 AND is_active = true
       AND EXISTS (
         SELECT 1 FROM unnest($2::text[]) AS cand
         WHERE cand LIKE country_code || '%'
       )
     ORDER BY LENGTH(country_code) DESC LIMIT 1`,
    [id, candidateArr]
  );
  return rows.length > 0 ? parseFloat(rows[0].rate) : null;
}

// ── MCC/MNC enrichment — batch lookup from global mcc_mnc_database ──

/**
 * Enrich a single destination with MCC/MNC/country/operator data.
 * Delegates to batchEnrichMccMnc for consistency.
 */
export async function enrichMccMnc(
  destination: string,
  existingClient?: PoolClient
): Promise<MccMncEnrichment | null> {
  const result = await batchEnrichMccMnc([destination], existingClient);
  return result.get(destination) || null;
}

/**
 * Batch-enrich multiple destinations with MCC/MNC data in a single DB query.
 * Returns a Map keyed by the original destination string.
 */
export async function batchEnrichMccMnc(
  destinations: string[],
  existingClient?: PoolClient
): Promise<Map<string, MccMncEnrichment>> {
  const result = new Map<string, MccMncEnrichment>();
  if (destinations.length === 0) return result;

  const dbClient = existingClient || await pool.connect();
  const shouldRelease = !existingClient;
  const savedSearchPath = existingClient
    ? (await dbClient.query("SHOW search_path")).rows[0]?.search_path
    : null;

  try {
    await dbClient.query("SET search_path TO public");

    // Build candidate phone numbers per destination (as-is, strip +, strip 0s,
    // strip 2-3 digit country codes) — flattened into one array with a
    // destIndex mapping back to the original destination.
    const allCandidates: string[] = [];
    const destIndex: number[] = []; // candidate → original destination index

    for (let i = 0; i < destinations.length; i++) {
      const dest = destinations[i];
      if (!dest) continue;
      const seen = new Set<string>();

      const add = (c: string) => {
        if (c && !seen.has(c)) {
          seen.add(c);
          allCandidates.push(c);
          destIndex.push(i);
        }
      };

      add(dest);
      add(dest.replace(/^\+/, ""));
      add(dest.replace(/^0+/, ""));
      // Also try stripping common 2-3 digit country codes
      const stripped = dest.replace(/^\+/, "");
      for (const cc of [stripped.slice(0, 2), stripped.slice(0, 3)]) {
        if (cc && cc.length >= 2) {
          add(stripped.slice(cc.length));
        }
      }
    }

    if (allCandidates.length === 0) return result;

    // Single query: match candidates against country_code prefixes in mcc_mnc_database
    const { rows } = await dbClient.query(
      `SELECT DISTINCT ON (cand) cand, mcc, mnc, country_name, network_name
       FROM (
         SELECT unnest($1::text[]) AS cand
       ) c
       JOIN mcc_mnc_database m ON cand LIKE m.country_code || '%'
       ORDER BY cand, LENGTH(m.country_code) DESC, LENGTH(m.mnc) DESC`,
      [allCandidates]
    );

    // Map results back to original destinations (first match wins per destination)
    for (const row of rows) {
      const idx = destIndex[allCandidates.indexOf(row.cand)];
      if (idx !== undefined && idx >= 0 && idx < destinations.length) {
        const orig = destinations[idx];
        if (!result.has(orig)) {
          result.set(orig, {
            mcc: row.mcc,
            mnc: row.mnc || "",
            countryName: row.country_name,
            networkName: row.network_name,
          });
        }
      }
    }

    return result;
  } catch (err) {
    console.error("[rates] Batch MCC/MNC enrichment error:", err);
    return result;
  } finally {
    if (savedSearchPath) {
      await dbClient.query(`SET search_path TO ${savedSearchPath}`);
    } else if (!shouldRelease) {
      await dbClient.query("SET search_path TO public");
    }
    if (shouldRelease) dbClient.release();
  }
}
