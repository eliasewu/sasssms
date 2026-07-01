import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") || "daily";
  const startDate = url.searchParams.get("startDate") || new Date(Date.now() - 30 * 86400000).toISOString();
  const endDate = url.searchParams.get("endDate") || new Date().toISOString();

  let dateGroup: string;
  switch (type) {
    case "hourly":
      dateGroup = "date_trunc('hour', created_at)";
      break;
    case "monthly":
      dateGroup = "date_trunc('month', created_at)";
      break;
    default:
      dateGroup = "date_trunc('day', created_at)";
  }

  const [volumeRes, clientRes, supplierRes, connectionRes, dlrRes] = await Promise.all([
    tenantQuery(
      tenant.schemaName,
      `SELECT ${dateGroup} as period, COUNT(*) as count, COALESCE(SUM(CAST(cost AS DECIMAL)), 0) as revenue
       FROM messages WHERE created_at >= $1 AND created_at <= $2
       GROUP BY period ORDER BY period`,
      [startDate, endDate]
    ),
    tenantQuery(
      tenant.schemaName,
      `SELECT c.name as client_name, COUNT(*) as count, COALESCE(SUM(CAST(m.cost AS DECIMAL)), 0) as revenue
       FROM messages m JOIN clients c ON m.client_id = c.id
       WHERE m.created_at >= $1 AND m.created_at <= $2
       GROUP BY c.name ORDER BY count DESC LIMIT 20`,
      [startDate, endDate]
    ),
    tenantQuery(
      tenant.schemaName,
      `SELECT s.name as supplier_name, COUNT(*) as count
       FROM messages m JOIN suppliers s ON m.supplier_id = s.id
       WHERE m.created_at >= $1 AND m.created_at <= $2
       GROUP BY s.name ORDER BY count DESC`,
      [startDate, endDate]
    ),
    tenantQuery(
      tenant.schemaName,
      `SELECT connection_type, COUNT(*) as count FROM messages 
       WHERE created_at >= $1 AND created_at <= $2 AND connection_type IS NOT NULL
       GROUP BY connection_type ORDER BY count DESC`,
      [startDate, endDate]
    ),
    tenantQuery(
      tenant.schemaName,
      `SELECT dlr_status, COUNT(*) as count FROM messages 
       WHERE created_at >= $1 AND created_at <= $2 AND dlr_status IS NOT NULL
       GROUP BY dlr_status`,
      [startDate, endDate]
    ),
  ]);

  return NextResponse.json({
    volume: volumeRes.rows,
    byClient: clientRes.rows,
    bySupplier: supplierRes.rows,
    byConnectionType: connectionRes.rows,
    dlrSummary: dlrRes.rows,
  });
}
