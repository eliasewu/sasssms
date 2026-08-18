import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export const dynamic = "force-dynamic";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();

  const result = await tenantQuery(
    tenant.schemaName,
    `UPDATE bank_accounts SET
      label=$1, account_holder_name=$2, bank_name=$3, account_number=$4, iban=$5,
      swift_bic=$6, bank_address=$7, currency=$8, usdt_wallet=$9, usdt_network=$10, is_active=$11
     WHERE id=$12 RETURNING *`,
    [
      body.label ?? null,
      body.accountHolderName ?? null,
      body.bankName ?? null,
      body.accountNumber ?? null,
      body.iban ?? null,
      body.swiftBic ?? null,
      body.bankAddress ?? null,
      body.currency ?? "USD",
      body.usdtWallet ?? null,
      body.usdtNetwork ?? null,
      body.isActive !== false,
      id,
    ]
  );
  return NextResponse.json({ bankAccount: result.rows[0] });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await tenantQuery(tenant.schemaName, "DELETE FROM bank_accounts WHERE id=$1", [id]);
  return NextResponse.json({ success: true });
}
