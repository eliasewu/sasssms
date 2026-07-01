import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [clientsRes, suppliersRes, messagesRes, statusRes, revenueRes, recentRes] = await Promise.all([
    tenantQuery(tenant.schemaName, "SELECT COUNT(*) as count FROM clients"),
    tenantQuery(tenant.schemaName, "SELECT COUNT(*) as count FROM suppliers"),
    tenantQuery(tenant.schemaName, "SELECT COUNT(*) as count FROM messages"),
    tenantQuery(
      tenant.schemaName,
      `SELECT status, COUNT(*) as count FROM messages GROUP BY status`
    ),
    tenantQuery(
      tenant.schemaName,
      `SELECT COALESCE(SUM(CAST(cost AS DECIMAL)), 0) as total FROM messages`
    ),
    tenantQuery(
      tenant.schemaName,
      `SELECT m.*, c.name as client_name FROM messages m LEFT JOIN clients c ON m.client_id = c.id ORDER BY m.id DESC LIMIT 10`
    ),
  ]);

  const statusMap: Record<string, number> = {};
  for (const row of statusRes.rows) {
    statusMap[row.status] = parseInt(row.count, 10);
  }

  return NextResponse.json({
    stats: {
      totalClients: parseInt(clientsRes.rows[0].count, 10),
      totalSuppliers: parseInt(suppliersRes.rows[0].count, 10),
      totalMessages: parseInt(messagesRes.rows[0].count, 10),
      totalRevenue: parseFloat(revenueRes.rows[0].total) || 0,
      messagesByStatus: statusMap,
    },
    recentMessages: recentRes.rows,
  });
}
