import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { getTenantInfo, sendClientWelcomeEmail } from "@/lib/billing-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const r = await tenantQuery(tenant.schemaName, "SELECT * FROM clients WHERE id = $1 AND deleted_at IS NULL", [id]);
  const client = r.rows[0];
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!client.email) return NextResponse.json({ error: "Client has no email address" }, { status: 400 });

  const info = await getTenantInfo(tenant.tenantId);
  if (!info) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const ok = await sendClientWelcomeEmail(info, client);
  if (!ok) return NextResponse.json({ error: "Failed to send welcome email. Check SMTP settings." }, { status: 500 });

  await tenantQuery(tenant.schemaName, "UPDATE clients SET welcome_email_sent = true WHERE id = $1", [id]);
  return NextResponse.json({ success: true, to: client.email });
}
