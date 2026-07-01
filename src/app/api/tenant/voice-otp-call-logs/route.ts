import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(tenant.schemaName, "SELECT id, destination, otp_code, language, status, attempt_count, duration, sip_config_id, sip_config_name, call_sid, country, mcc, audio_playlist, attempt_log, created_at FROM voice_otp_call_logs ORDER BY id DESC LIMIT 200");
  return NextResponse.json({ logs: result.rows });
}
