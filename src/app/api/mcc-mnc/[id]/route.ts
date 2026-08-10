import { NextResponse } from "next/server";
import { pool } from "@/db";
import { padMnc } from "@/lib/mcc-lookup-client";
import { getSuperAdminFromRequest, getTenantFromRequest } from "@/lib/auth";
import { syncMccMncToTenants } from "@/lib/mcc-mnc-sync";

// Tenants and super admins both edit the global database (existing behavior),
// so either session is accepted. Only super-admin changes cascade to every
// tenant's rate tables.
const authorize = (request: Request) => {
  if (!getTenantFromRequest(request) && !getSuperAdminFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized — valid tenant or super admin session required" }, { status: 401 });
  }
  return null;
};

const isSuperAdmin = (request: Request) => !!getSuperAdminFromRequest(request);

// PUT — Update a single MCC/MNC entry
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = authorize(request);
  if (unauthorized) return unauthorized;
  const superAdmin = isSuperAdmin(request);

  const { id } = await params;
  const client = await pool.connect();
  try {
    const body = await request.json();
    const { mcc, mnc, countryCode, countryName, networkName } = body;

    if (!mcc || !countryName) {
      return NextResponse.json({ error: "MCC and country name required" }, { status: 400 });
    }

    // Fetch the entry as it exists now — needed to sync tenant rows by the
    // OLD (mcc, mnc) key when the key itself is being changed.
    const { rows: before } = await client.query(
      `SELECT mcc, mnc, country_code AS "countryCode", country_name AS "countryName",
              network_name AS "networkName"
       FROM mcc_mnc_database WHERE id = $1`,
      [parseInt(id)]
    );
    if (before.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const old = before[0];

    // Store the canonical zero-padded MNC ("3" → "003") and reject the update
    // if another row would collide on the padded (mcc, mnc) key.
    const mncPadded = padMnc(mnc) || null;

    const { rows: collision } = await client.query(
      `SELECT id FROM mcc_mnc_database
       WHERE mcc = $1 AND LPAD(COALESCE(mnc,''), 3, '0') = $2 AND id <> $3`,
      [mcc, padMnc(mnc), parseInt(id)]
    );
    if (collision.length > 0) {
      return NextResponse.json({ error: "Another entry with this MCC/MNC already exists" }, { status: 409 });
    }

    const { rows } = await client.query(
      `UPDATE mcc_mnc_database
       SET mcc = $1::text, mnc = $2::text, country_code = $3::text, country_name = $4::text,
           network_name = $5::text, mccmnc = $1::text || LPAD(COALESCE($2::text,''), 3, '0')
       WHERE id = $6
       RETURNING *`,
      [mcc, mncPadded, countryCode, countryName, networkName || null, parseInt(id)]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Super-admin edits propagate to all active tenants' shared-default rate
    // rows — but only when something actually changed, so a no-op save is cheap.
    const changed =
      old.mcc !== mcc ||
      (old.mnc || "") !== (mncPadded || "") ||
      (old.countryCode || "") !== (countryCode || "") ||
      (old.countryName || "") !== (countryName || "") ||
      (old.networkName || "") !== (networkName || "");

    let sync;
    if (superAdmin && changed) {
      sync = await syncMccMncToTenants(
        pool,
        { mcc, mnc: mncPadded, countryCode: countryCode || "", networkName: networkName || null },
        "update",
        { mcc: old.mcc, mnc: old.mnc || null }
      );
    }

    return NextResponse.json({ data: rows[0], sync });
  } catch (error) {
    console.error("MCC/MNC update error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  } finally {
    client.release();
  }
}

// DELETE — Remove a single MCC/MNC entry
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = authorize(request);
  if (unauthorized) return unauthorized;
  const superAdmin = isSuperAdmin(request);

  const { id } = await params;
  const client = await pool.connect();
  try {
    // Fetch the entry first so we can remove the same key from tenant tables.
    const { rows: existing } = await client.query(
      `SELECT mcc, mnc, country_code AS "countryCode", network_name AS "networkName"
       FROM mcc_mnc_database WHERE id = $1`,
      [parseInt(id)]
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const entry = existing[0];

    const { rowCount } = await client.query(
      "DELETE FROM mcc_mnc_database WHERE id = $1",
      [parseInt(id)]
    );

    if (rowCount === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Super-admin deletes also remove the shared-default rows for this entry
    // from all active tenants. Tenant deletes stay global-only.
    let sync;
    if (superAdmin) {
      sync = await syncMccMncToTenants(
        pool,
        { mcc: entry.mcc, mnc: entry.mnc || null, countryCode: entry.countryCode || "", networkName: entry.networkName || null },
        "delete"
      );
    }

    return NextResponse.json({ success: true, message: "Entry deleted", sync });
  } catch (error) {
    console.error("MCC/MNC delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  } finally {
    client.release();
  }
}
