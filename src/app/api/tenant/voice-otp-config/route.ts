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
