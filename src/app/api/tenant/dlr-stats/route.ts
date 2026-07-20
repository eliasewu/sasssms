import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const hours = parseInt(url.searchParams.get("hours") || "24");

  const since = new Date(Date.now() - hours * 3600000).toISOString();

  // Run all queries in parallel
  const [dlrSummary, supplierBreakdown, recentDlrs, totalProfit, hourlyTrend] = await Promise.all([
    // Overall DLR status counts
    tenantQuery(
      tenant.schemaName,
      `SELECT 
         COALESCE(dlr_status, 'PENDING') as status,
         COUNT(*) as count,
         COALESCE(SUM(CAST(cost AS DECIMAL)), 0) as total_cost,
         COALESCE(SUM(CAST(COALESCE(profit, '0') AS DECIMAL)), 0) as total_profit
       FROM messages 
       WHERE created_at >= $1
       GROUP BY COALESCE(dlr_status, 'PENDING')
       ORDER BY 
         CASE COALESCE(dlr_status, 'PENDING')
           WHEN 'DELIVERED' THEN 1
           WHEN 'PENDING' THEN 2
           WHEN 'FAILED' THEN 3
           ELSE 4
         END`,
      [since]
    ),

    // Supplier-level DLR breakdown
    tenantQuery(
      tenant.schemaName,
      `SELECT 
         s.id as supplier_id,
         s.name as supplier_name,
         s.host,
         s.connection_type,
         s.bind_status,
         COALESCE(m.dlr_status, 'PENDING') as dlr_status,
         COUNT(*) as count,
         COALESCE(SUM(CAST(m.cost AS DECIMAL)), 0) as revenue,
         COALESCE(SUM(CAST(COALESCE(m.supplier_cost, '0') AS DECIMAL)), 0) as cost,
         COALESCE(SUM(CAST(COALESCE(m.profit, '0') AS DECIMAL)), 0) as profit
       FROM messages m
       JOIN suppliers s ON m.supplier_id = s.id
       WHERE m.created_at >= $1
       GROUP BY s.id, s.name, s.host, s.connection_type, s.bind_status, COALESCE(m.dlr_status, 'PENDING')
       ORDER BY s.name, 
         CASE COALESCE(m.dlr_status, 'PENDING')
           WHEN 'DELIVERED' THEN 1
           WHEN 'PENDING' THEN 2
           WHEN 'FAILED' THEN 3
           ELSE 4
         END`,
      [since]
    ),

    // Recent messages with DLR status (last 50)
    tenantQuery(
      tenant.schemaName,
      `SELECT 
         m.id, m.message_id, m.supplier_message_id,
         m.sender, m.destination, m.content,
         m.status, m.dlr_status, m.dlr_timestamp,
         m.cost, m.supplier_cost, m.profit,
         m.supplier_id, s.name as supplier_name,
         m.client_id, c.name as client_name,
         m.connection_type, m.created_at
       FROM messages m
       LEFT JOIN suppliers s ON m.supplier_id = s.id
       LEFT JOIN clients c ON m.client_id = c.id
       WHERE m.created_at >= $1
       ORDER BY m.created_at DESC
       LIMIT 50`,
      [since]
    ),

    // Total profit by DLR status
    tenantQuery(
      tenant.schemaName,
      `SELECT 
         COALESCE(SUM(CAST(COALESCE(profit, '0') AS DECIMAL)), 0) as total_profit,
         COALESCE(SUM(CAST(cost AS DECIMAL)), 0) as total_revenue,
         COALESCE(SUM(CAST(COALESCE(supplier_cost, '0') AS DECIMAL)), 0) as total_cost,
         COUNT(*) as total_messages,
         COUNT(*) FILTER (WHERE dlr_status = 'DELIVERED') as delivered,
         COUNT(*) FILTER (WHERE dlr_status = 'FAILED') as failed,
         COUNT(*) FILTER (WHERE dlr_status IS NULL OR dlr_status = 'PENDING') as pending
       FROM messages
       WHERE created_at >= $1`,
      [since]
    ),

    // Hourly DLR trend (last 24h)
    tenantQuery(
      tenant.schemaName,
      `SELECT 
         date_trunc('hour', m.created_at) as hour,
         COUNT(*) FILTER (WHERE m.dlr_status = 'DELIVERED') as delivered,
         COUNT(*) FILTER (WHERE m.dlr_status = 'FAILED') as failed,
         COUNT(*) FILTER (WHERE m.dlr_status IS NULL OR m.dlr_status = 'PENDING') as pending,
         COUNT(*) as total
       FROM messages m
       WHERE m.created_at >= $1
       GROUP BY date_trunc('hour', m.created_at)
       ORDER BY hour`,
      [since]
    ),
  ]);

  // Build supplier summary (aggregated per supplier)
  const supplierRows = supplierBreakdown.rows as Record<string, unknown>[];
  const supplierMap = new Map<number, {
    supplierId: number;
    supplierName: string;
    host: string;
    connectionType: string;
    bindStatus: string;
    delivered: number;
    pending: number;
    failed: number;
    revenue: number;
    cost: number;
    profit: number;
  }>();

  for (const row of supplierRows) {
    const sid = row.supplier_id as number;
    if (!supplierMap.has(sid)) {
      supplierMap.set(sid, {
        supplierId: sid,
        supplierName: row.supplier_name as string,
        host: (row.host as string) || "—",
        connectionType: (row.connection_type as string) || "SMPP",
        bindStatus: (row.bind_status as string) || "UNKNOWN",
        delivered: 0,
        pending: 0,
        failed: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      });
    }
    const entry = supplierMap.get(sid)!;
    const status = (row.dlr_status as string) || "PENDING";
    const count = parseInt(row.count as string) || 0;
    if (status === "DELIVERED") entry.delivered += count;
    else if (status === "FAILED") entry.failed += count;
    else entry.pending += count;
    entry.revenue += parseFloat(row.revenue as string) || 0;
    entry.cost += parseFloat(row.cost as string) || 0;
    entry.profit += parseFloat(row.profit as string) || 0;
  }

  return NextResponse.json({
    overview: totalProfit.rows[0] || { total_profit: 0, total_revenue: 0, total_cost: 0, total_messages: 0, delivered: 0, failed: 0, pending: 0 },
    dlrSummary: dlrSummary.rows,
    suppliers: Array.from(supplierMap.values()),
    recentMessages: recentDlrs.rows,
    hourlyTrend: hourlyTrend.rows,
    periodHours: hours,
  });
}
