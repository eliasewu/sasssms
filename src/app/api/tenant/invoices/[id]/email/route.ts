import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import {
  loadInvoiceRenderData,
  buildInvoiceHtml,
  buildInvoicePdf,
  buildInvoiceXlsx,
  sendInvoiceEmail,
} from "@/lib/billing-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  let data;
  try {
    data = await loadInvoiceRenderData(tenant.schemaName, parseInt(id));
  } catch {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (!data.entityEmail) {
    return NextResponse.json({ error: "This client/supplier has no email address." }, { status: 400 });
  }

  const html = buildInvoiceHtml(data);
  const ok = await sendInvoiceEmail(
    tenant.schemaName,
    data.entityEmail,
    `Invoice ${data.invoiceNumber} — ${data.currency} ${data.grandTotal.toFixed(6)}`,
    html,
    [
      { filename: `${data.invoiceNumber}.xlsx`, content: buildInvoiceXlsx(data), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      { filename: `${data.invoiceNumber}.pdf`, content: buildInvoicePdf(data), contentType: "application/pdf" },
    ]
  );

  if (!ok) return NextResponse.json({ error: "Failed to send invoice email. Check SMTP settings." }, { status: 500 });

  await tenantQuery(
    tenant.schemaName,
    `UPDATE invoices SET status = CASE WHEN status = 'DRAFT' THEN 'SENT' ELSE status END, email_sent_at = NOW() WHERE id = $1`,
    [id]
  );
  return NextResponse.json({ success: true, to: data.entityEmail });
}
