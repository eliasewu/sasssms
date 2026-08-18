import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import {
  getInvoiceSettings,
  allocateInvoiceNumber,
  buildLineItems,
  createDashboardAlert,
} from "@/lib/billing-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(
    tenant.schemaName,
    "SELECT i.*, c.name as client_name FROM invoices i LEFT JOIN clients c ON i.client_id = c.id ORDER BY i.id DESC"
  );
  return NextResponse.json({ invoices: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();
  const { clientId, supplierId, periodStart, periodEnd, notes } = body;

  const settings = await getInvoiceSettings(tenant.schemaName);
  const createdForType: string = (body as any).createdForType || (clientId ? "client" : supplierId ? "supplier" : "unknown");
  const createdForId = clientId || supplierId;
  const kind: "client" | "supplier" = createdForType === "supplier" ? "supplier" : "client";

  // Resolve the "Invoice to" entity from the client/supplier page
  let entity: Record<string, any> = {};
  if (kind === "client" && clientId) {
    const r = await tenantQuery(tenant.schemaName, "SELECT * FROM clients WHERE id = $1", [clientId]);
    entity = r.rows[0] || {};
  } else if (kind === "supplier" && supplierId) {
    const r = await tenantQuery(tenant.schemaName, "SELECT * FROM suppliers WHERE id = $1", [supplierId]);
    entity = r.rows[0] || {};
  }
  if (!createdForId) {
    return NextResponse.json({ error: "clientId or supplierId required" }, { status: 400 });
  }

  const taxRate = body.taxRate !== undefined ? parseFloat(body.taxRate) : settings.taxRate;
  const currency = body.currency || settings.currency;

  // Build MCC/network line items from messages
  const { items, totalSms, totalCharge } = await buildLineItems(
    tenant.schemaName,
    kind,
    createdForId,
    periodStart,
    periodEnd
  );

  const tax = Math.round(totalCharge * (taxRate / 100) * 1_000_000) / 1_000_000;
  const totalAmount = Math.round((totalCharge + tax) * 1_000_000) / 1_000_000;
  const invoiceNumber = await allocateInvoiceNumber(tenant.schemaName, settings);

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + settings.dueDays);
  const issueDate = new Date();

  const createdForName = (entity.company_name || entity.name || "Unknown") as string;

  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO invoices (client_id, invoice_number, amount, tax, total_amount, status, period_start, period_end, due_date, notes, created_by, created_for_type, created_for_id, created_for_name, currency, issue_date)
     VALUES ($1,$2,$3,$4,$5,'DRAFT',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [
      kind === "client" ? clientId : null,
      invoiceNumber,
      totalCharge,
      tax,
      totalAmount,
      periodStart,
      periodEnd,
      dueDate.toISOString(),
      notes || null,
      tenant.email,
      createdForType,
      createdForId,
      createdForName,
      currency,
      issueDate.toISOString(),
    ]
  );

  const invoice = result.rows[0];
  for (const it of items) {
    await tenantQuery(
      tenant.schemaName,
      `INSERT INTO invoice_items (invoice_id, network, country, mcc, total_sms, rate, total_charge, remarks)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [invoice.id, it.network, it.country, it.mcc, it.totalSms, it.rate, it.totalCharge, it.remarks]
    );
  }

  await createDashboardAlert(
    tenant.schemaName,
    "invoice_generated",
    `Invoice ${invoiceNumber} generated`,
    `Invoice ${invoiceNumber} created for ${createdForName} (${totalSms} SMS, ${totalAmount} ${currency}).`,
    "info"
  );

  revalidatePath("/dashboard/invoices");
  return NextResponse.json(
    {
      invoice,
      details: { messageCount: totalSms, amount: totalCharge, tax, totalAmount, totalCharge, profit: totalCharge, createdForName, items, currency, invoiceNumber },
    },
    { status: 201 }
  );
}
