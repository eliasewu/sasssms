import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { getSmtpConfig, sendTenantEmail } from "@/lib/billing-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const cfg = await getSmtpConfig(tenant.schemaName);
  return NextResponse.json({ smtp: cfg });
}

export async function PUT(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE smtp_config SET
       host=$1, port=$2, username=$3, password=$4, from_email=$5, from_name=$6, encryption=$7, is_active=$8
     WHERE id = (SELECT id FROM smtp_config ORDER BY id LIMIT 1)
     RETURNING *`,
    [
      body.host ?? "",
      parseInt(body.port) || 587,
      body.username ?? null,
      body.password ?? null,
      body.fromEmail ?? null,
      body.fromName ?? "Net2APP",
      body.encryption ?? "tls",
      body.isActive !== false,
    ]
  );
  if (result.rows.length === 0) {
    const inserted = await tenantQuery(
      tenant.schemaName,
      `INSERT INTO smtp_config (host, port, username, password, from_email, from_name, encryption, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        body.host ?? "",
        parseInt(body.port) || 587,
        body.username ?? null,
        body.password ?? null,
        body.fromEmail ?? null,
        body.fromName ?? "Net2APP",
        body.encryption ?? "tls",
        body.isActive !== false,
      ]
    );
    return NextResponse.json({ smtp: inserted.rows[0] });
  }
  return NextResponse.json({ smtp: result.rows[0] });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const ok = await sendTenantEmail(tenant.schemaName, {
    to: body.to || tenant.email,
    subject: "SMTP Test — Net2APP",
    html: `<div style="font-family:Arial,sans-serif;"><h3>SMTP Test Successful ✅</h3><p>Your SMTP settings are working correctly.</p></div>`,
  });
  if (!ok) return NextResponse.json({ error: "Failed to send test email. Check SMTP settings." }, { status: 500 });
  return NextResponse.json({ success: true });
}
