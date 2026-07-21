import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { pool } from "@/db";
import { lookupMccMnc } from "@/lib/mcc-lookup";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT mcc, mnc, mccmnc, country_code as "countryCode", country_name as "countryName", 
              network_name as "networkName", network_type as "networkType"
       FROM mcc_mnc_database 
       ORDER BY country_name ASC, network_name ASC`
    );

    // Build tree: country → operators
    const tree: Record<string, {
      countryCode: string;
      countryName: string;
      operators: { mcc: string; mnc: string; networkName: string; networkType: string }[];
    }> = {};

    for (const row of result.rows) {
      const key = row.countryName;
      if (!tree[key]) {
        tree[key] = { countryCode: row.countryCode, countryName: row.countryName, operators: [] };
      }
      tree[key].operators.push({
        mcc: row.mcc,
        mnc: row.mnc || "",
        mccmnc: row.mccmnc,
        networkName: row.networkName || "Unknown",
        networkType: row.networkType || "",
      });
    }

    return NextResponse.json({
      countries: Object.values(tree),
      totalOperators: result.rows.length,
    });
  } catch (err) {
    console.error("MCCMNC fetch error:", err);
    return NextResponse.json({ error: "Failed to load MCC/MNC data" }, { status: 500 });
  } finally {
    client.release();
  }
}

/**
 * POST /api/tenant/mccmnc — batch MNC lookup for phone numbers
 * Body: { numbers: string[] }
 * Returns: { results: { number, mcc, mnc, countryName, networkName }[] }
 */
export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const numbers: string[] = body.numbers || [];
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return NextResponse.json({ results: [] });
  }

  // Deduplicate and limit
  const unique = [...new Set(numbers)].slice(0, 100);
  const results: { number: string; mcc: string; mnc: string; mccmnc: string; countryName: string | null; networkName: string | null }[] = [];

  for (const num of unique) {
    try {
      const lookup = await lookupMccMnc(num);
      results.push({
        number: num,
        mcc: lookup.mcc,
        mnc: lookup.mnc,
        mccmnc: lookup.mccmnc,
        countryName: lookup.countryName,
        networkName: lookup.networkName,
      });
    } catch {
      results.push({ number: num, mcc: "", mnc: "", mccmnc: "", countryName: null, networkName: null });
    }
  }

  return NextResponse.json({ results });
}
