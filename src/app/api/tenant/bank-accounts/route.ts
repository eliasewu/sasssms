import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const result = await tenantQuery(tenant.schemaName, "SELECT * FROM bank_accounts ORDER BY id");
  return NextResponse.json({ bankAccounts: result.rows });
}

export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json();

  const result = await tenantQuery(
    tenant.schemaName,
    `INSERT INTO bank_accounts
      (label, account_holder_name, bank_name, account_number, iban, swift_bic, bank_address, currency, usdt_wallet, usdt_network, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      body.label || null,
      body.accountHolderName || null,
      body.bankName || null,
      body.accountNumber || null,
      body.iban || null,
      body.swiftBic || null,
      body.bankAddress || null,
      body.currency || "USD",
      body.usdtWallet || null,
      body.usdtNetwork || null,
      body.isActive !== false,
    ]
  );
  return NextResponse.json({ bankAccount: result.rows[0] }, { status: 201 });
}
