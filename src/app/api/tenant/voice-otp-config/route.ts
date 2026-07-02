import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM voice_otp_config ORDER BY id DESC");
  return NextResponse.json({ configs: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();

  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO voice_otp_config (country_group, prefixes, primary_language, secondary_language) VALUES ($1,$2,$3,$4) RETURNING *`,
    [body.countryGroup, body.prefixes, body.primaryLanguage, body.secondaryLanguage || null]
  );

  return NextResponse.json({ config: result.rows[0] }, { status: 201 });
}

export async function PUT(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE voice_otp_config SET country_group=$1, prefixes=$2, primary_language=$3, secondary_language=$4, is_active=$5 WHERE id=$6 RETURNING *`,
    [body.countryGroup, body.prefixes, body.primaryLanguage, body.secondaryLanguage || null, body.isActive ?? true, body.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  return NextResponse.json({ config: result.rows[0] });
}

export async function DELETE(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  // Delete config first, then cleanup associated audio files
  const result = await tenantQuery(
    tenant.schemaName,
    "DELETE FROM voice_otp_config WHERE id = $1 RETURNING id",
    [parseInt(id)]
  );

  // Cleanup associated audio files (non-fatal if it fails)
  await tenantQuery(tenant.schemaName, "DELETE FROM voice_otp_audio WHERE config_id = $1", [parseInt(id)])

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
