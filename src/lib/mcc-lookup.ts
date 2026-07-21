/**
 * MCC/MNC Lookup Utility (Server-Side)
 *
 * Extends the client-safe mcc-lookup-client with database-backed
 * MNC resolution using the mcc_mnc_database and mcc_mnc_prefix_map tables.
 */
import { pool } from "@/db";
import { lookupMccSync, DIAL_TO_MCC, formatMccMnc } from "@/lib/mcc-lookup-client";

export interface MccMncResult {
  mcc: string;
  mnc: string;
  mccmnc: string;
  countryName: string | null;
  networkName: string | null;
}

/**
 * Look up MCC and MNC from a phone number (server-side, with DB query).
 *
 * Strategy:
 * 1. Use client-safe lookupMccSync for MCC resolution from dialing code
 * 2. Strip the dialing code to get the local number
 * 3. Query mcc_mnc_prefix_map for MNC by prefix-matching local number
 *    against known phone number prefixes for this MCC
 * 4. Fall back to mcc_mnc_database MNC matching (legacy methods)
 */
export async function lookupMccMnc(destination: string): Promise<MccMncResult> {
  const { mcc } = lookupMccSync(destination);
  const cleaned = destination.replace(/^\+/, "").replace(/[^0-9]/g, "");

  if (!cleaned || cleaned.length < 3) {
    return { mcc: "", mnc: "", mccmnc: "", countryName: null, networkName: null };
  }

  // Derive local number by stripping the dialing code that matches this MCC
  let localNumber = cleaned;
  if (mcc) {
    const dialCodes = Object.keys(DIAL_TO_MCC).sort((a, b) => b.length - a.length);
    for (const dial of dialCodes) {
      if (cleaned.startsWith(dial) && DIAL_TO_MCC[dial] === mcc) {
        localNumber = cleaned.slice(dial.length);
        break;
      }
    }
  }

  // Normalize: strip any leading "0" trunk prefix for prefix matching
  const normalizedLocal = localNumber.replace(/^0+/, "");

  let mnc = "";
  let countryName: string | null = null;
  let networkName: string | null = null;

  try {
    const client = await pool.connect();
    try {
      if (mcc) {
        // ── Attempt 1: Prefix map lookup (phone prefix → MNC) ──
        // This handles countries like Bangladesh where MNC "02" != phone prefix "018"
        const prefixResult = await client.query(
          `SELECT mnc, network_name, country_name
           FROM mcc_mnc_prefix_map
           WHERE mcc = $1 AND $2 LIKE prefix || '%'
           ORDER BY LENGTH(prefix) DESC LIMIT 1`,
          [mcc, normalizedLocal]
        );
        if (prefixResult.rows.length > 0) {
          mnc = prefixResult.rows[0].mnc as string;
          networkName = prefixResult.rows[0].network_name as string;
          countryName = prefixResult.rows[0].country_name as string;
        }

        // ── Attempt 2: Legacy — direct prefix match from mcc_mnc_database ──
        if (!mnc) {
          const result = await client.query(
            `SELECT mnc, country_name, network_name
             FROM mcc_mnc_database
             WHERE mcc = $1 AND mnc IS NOT NULL AND mnc != ''
             ORDER BY LENGTH(mnc) DESC`,
            [mcc]
          );

          for (const row of result.rows) {
            const mncPrefix = row.mnc as string;
            if (localNumber.startsWith(mncPrefix)) {
              mnc = mncPrefix;
              networkName = row.network_name as string;
              break;
            }
          }

          // ── Attempt 3: Reverse match (MNC code contains local prefix) ──
          if (!mnc && localNumber.length >= 2) {
            for (const row of result.rows) {
              const mncCode = row.mnc as string;
              if (mncCode.includes(localNumber.slice(0, 2))) {
                mnc = mncCode;
                networkName = row.network_name as string;
                break;
              }
            }
          }

          if (!countryName && result.rows.length > 0) {
            countryName = result.rows[0].country_name as string;
          }
        }
      }
    } finally {
      client.release();
    }
  } catch {
    // DB lookup failed; return what we have
  }

  return { mcc, mnc, mccmnc: formatMccMnc(mcc, mnc), countryName, networkName };
}
