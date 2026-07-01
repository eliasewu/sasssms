import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM voice_otp_audio ORDER BY id");
  return NextResponse.json({ audio: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const { configId, language, digit, fileName, fileUrl, audioType } = body;

  // Check if already exists
  const existing = await tenantQuery(tenant.schemaName,
    "SELECT id FROM voice_otp_audio WHERE config_id = $1 AND language = $2 AND digit = $3",
    [configId, language, digit]);
  
  if (existing.rows.length > 0) {
    await tenantQuery(tenant.schemaName,
      "UPDATE voice_otp_audio SET file_name = $1, file_url = $2, audio_type = $3 WHERE id = $4",
      [fileName, fileUrl, audioType || "wav", existing.rows[0].id]);
    return NextResponse.json({ success: true, action: "updated" });
  }

  await tenantQuery(tenant.schemaName,
    "INSERT INTO voice_otp_audio (config_id, language, digit, file_name, file_url, audio_type) VALUES ($1,$2,$3,$4,$5,$6)",
    [configId, language, digit, fileName, fileUrl, audioType || "wav"]);

  // Update audio count
  const countResult = await tenantQuery(tenant.schemaName,
    "SELECT COUNT(*) as c FROM voice_otp_audio WHERE config_id = $1 AND language = $2",
    [configId, language]);
  
  const isPrimary = language === (await tenantQuery(tenant.schemaName,
    "SELECT primary_language FROM voice_otp_config WHERE id = $1", [configId])).rows[0]?.primary_language;
  
  if (isPrimary) {
    await tenantQuery(tenant.schemaName,
      "UPDATE voice_otp_config SET primary_audio_count = $1 WHERE id = $2",
      [countResult.rows[0].c, configId]);
  } else {
    await tenantQuery(tenant.schemaName,
      "UPDATE voice_otp_config SET secondary_audio_count = $1 WHERE id = $2",
      [countResult.rows[0].c, configId]);
  }

  return NextResponse.json({ success: true, action: "inserted" }, { status: 201 });
}
