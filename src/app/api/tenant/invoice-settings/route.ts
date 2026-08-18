import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { getInvoiceSettings } from "@/lib/billing-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const settings = await getInvoiceSettings(tenant.schemaName);
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE invoice_settings SET
       currency=$1, timezone=$2, tax_rate=$3, due_days=$4, invoice_prefix=$5,
       next_invoice_number=$6, default_bank_account_id=$7,
       auto_email_invoice=$8, notify_rate_change=$9, notify_low_balance=$10, welcome_email_auto=$11,
       updated_at=NOW()
     WHERE id=$12 RETURNING *`,
    [
      body.currency ?? "USD",
      body.timezone ?? "UTC",
      parseFloat(body.taxRate ?? "0") || 0,
      parseInt(body.dueDays ?? "15") || 15,
      body.invoicePrefix ?? "",
      parseInt(body.nextInvoiceNumber ?? "1000") || 1000,
      body.defaultBankAccountId ?? null,
      body.autoEmailInvoice === true,
      body.notifyRateChange !== false,
      body.notifyLowBalance !== false,
      body.welcomeEmailAuto !== false,
      body.id ?? 1,
    ]
  );
  if (result.rows.length === 0) {
    const inserted = await tenantQuery(
      tenant.schemaName,
      `INSERT INTO invoice_settings (id, currency, timezone, tax_rate, due_days, invoice_prefix, next_invoice_number, default_bank_account_id, auto_email_invoice, notify_rate_change, notify_low_balance, welcome_email_auto)
       VALUES (1, $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        body.currency ?? "USD",
        body.timezone ?? "UTC",
        parseFloat(body.taxRate ?? "0") || 0,
        parseInt(body.dueDays ?? "15") || 15,
        body.invoicePrefix ?? "",
        parseInt(body.nextInvoiceNumber ?? "1000") || 1000,
        body.defaultBankAccountId ?? null,
        body.autoEmailInvoice === true,
        body.notifyRateChange !== false,
        body.notifyLowBalance !== false,
        body.welcomeEmailAuto !== false,
      ]
    );
    return NextResponse.json({ settings: inserted.rows[0] });
  }
  return NextResponse.json({ settings: result.rows[0] });
}
