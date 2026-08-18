import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { getTenantInfo, sendSupplierWelcomeEmail } from "@/lib/billing-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const r = await tenantQuery(tenant.schemaName, "SELECT * FROM suppliers WHERE id = $1 AND deleted_at IS NULL", [id]);
  const supplier = r.rows[0];
  if (!supplier) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const email = supplier.billing_email || supplier.email;
  if (!email) return NextResponse.json({ error: "Supplier has no email address" }, { status: 400 });

  const info = await getTenantInfo(tenant.tenantId);
  if (!info) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });

  const ok = await sendSupplierWelcomeEmail(info, supplier);
  if (!ok) return NextResponse.json({ error: "Failed to send welcome email. Check SMTP settings." }, { status: 500 });

  await tenantQuery(tenant.schemaName, "UPDATE suppliers SET welcome_email_sent = true WHERE id = $1", [id]);
  return NextResponse.json({ success: true, to: email });
}
