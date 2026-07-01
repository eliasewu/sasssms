import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [revenue, pending, paid, outstanding] = await Promise.all([
    tenantQuery(tenant.schemaName, "SELECT COALESCE(SUM(CAST(cost AS DECIMAL)), 0) as total FROM messages"),
    tenantQuery(tenant.schemaName, "SELECT COUNT(*) as count FROM invoices WHERE status IN ('DRAFT', 'SENT')"),
    tenantQuery(tenant.schemaName, "SELECT COUNT(*) as count FROM invoices WHERE status = 'PAID'"),
    tenantQuery(tenant.schemaName, "SELECT COALESCE(SUM(CAST(total_amount AS DECIMAL)), 0) as total FROM invoices WHERE status IN ('SENT', 'OVERDUE')"),
  ]);

  return NextResponse.json({
    stats: {
      totalRevenue: parseFloat(revenue.rows[0].total) || 0,
      pendingInvoices: parseInt(pending.rows[0].count) || 0,
      paidInvoices: parseInt(paid.rows[0].count) || 0,
      outstandingAmount: parseFloat(outstanding.rows[0].total) || 0,
    },
  });
}
