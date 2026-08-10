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
  // Optional connection-type filter ("Business API", "SMPP", "WhatsApp OTT",
  // "CUSTOM_API", "VOICE_OTP", ...). When set, every summary below is scoped
  // to that channel so admins can chart per-channel delivery stats.
  const connectionType = url.searchParams.get("connectionType") || "";
  const connClause = connectionType ? ` AND m.connection_type = $3` : "";
  const connClauseNoAlias = connectionType ? ` AND connection_type = $3` : "";
  const connVal: (string | number)[] = connectionType ? [connectionType] : [];

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

  const [volumeRes, clientRes, supplierRes, connectionRes, dlrRes, chargingRes] = await Promise.all([
    tenantQuery(
      tenant.schemaName,
      `SELECT ${dateGroup} as period, COUNT(*) as count,
              COALESCE(SUM(CAST(cost AS DECIMAL)), 0) as revenue,
              COALESCE(SUM(CAST(COALESCE(supplier_cost, '0') AS DECIMAL)), 0) as cost,
              COALESCE(SUM(CAST(COALESCE(profit, '0') AS DECIMAL)), 0) as profit
       FROM messages WHERE created_at >= $1 AND created_at <= $2${connClauseNoAlias}
       GROUP BY period ORDER BY period`,
      [startDate, endDate, ...connVal]
    ),
    tenantQuery(
      tenant.schemaName,
      `SELECT c.name as client_name, c.id as client_id, COUNT(*) as count,
              COALESCE(SUM(CAST(m.cost AS DECIMAL)), 0) as revenue,
              COALESCE(SUM(CAST(COALESCE(m.supplier_cost, '0') AS DECIMAL)), 0) as cost,
              COALESCE(SUM(CAST(COALESCE(m.profit, '0') AS DECIMAL)), 0) as profit
       FROM messages m JOIN clients c ON m.client_id = c.id
       WHERE m.created_at >= $1 AND m.created_at <= $2${connClause}
       GROUP BY c.name, c.id ORDER BY count DESC LIMIT 20`,
      [startDate, endDate, ...connVal]
    ),
    tenantQuery(
      tenant.schemaName,
      `SELECT s.name as supplier_name, s.id as supplier_id, COUNT(*) as count,
              COALESCE(SUM(CAST(COALESCE(m.supplier_cost, '0') AS DECIMAL)), 0) as cost
       FROM messages m JOIN suppliers s ON m.supplier_id = s.id
       WHERE m.created_at >= $1 AND m.created_at <= $2${connClause}
       GROUP BY s.name, s.id ORDER BY count DESC`,
      [startDate, endDate, ...connVal]
    ),
    tenantQuery(
      tenant.schemaName,
      `SELECT connection_type, COUNT(*) as count FROM messages 
       WHERE created_at >= $1 AND created_at <= $2 AND connection_type IS NOT NULL${connClauseNoAlias}
       GROUP BY connection_type ORDER BY count DESC`,
      [startDate, endDate, ...connVal]
    ),
    tenantQuery(
      tenant.schemaName,
      `SELECT dlr_status, COUNT(*) as count FROM messages 
       WHERE created_at >= $1 AND created_at <= $2 AND dlr_status IS NOT NULL${connClauseNoAlias}
       GROUP BY dlr_status`,
      [startDate, endDate, ...connVal]
    ),
    // Charging mode breakdown: messages by client charging_mode
    tenantQuery(
      tenant.schemaName,
      `SELECT COALESCE(c.charging_mode, CASE WHEN c.force_dlr THEN 'force_dlr' WHEN c.billing_mode = 'dlr' THEN 'on_dlr' ELSE 'on_submit' END) as charging_mode,
              COUNT(*) as count,
              COALESCE(SUM(CAST(m.cost AS DECIMAL)), 0) as revenue,
              COALESCE(SUM(CAST(COALESCE(m.supplier_cost, '0') AS DECIMAL)), 0) as cost,
              COALESCE(SUM(CAST(COALESCE(m.profit, '0') AS DECIMAL)), 0) as profit
       FROM messages m
       LEFT JOIN clients c ON m.client_id = c.id
       WHERE m.created_at >= $1 AND m.created_at <= $2${connClause}
       GROUP BY COALESCE(c.charging_mode, CASE WHEN c.force_dlr THEN 'force_dlr' WHEN c.billing_mode = 'dlr' THEN 'on_dlr' ELSE 'on_submit' END)
       ORDER BY count DESC`,
      [startDate, endDate, ...connVal]
    ),
  ]);

  return NextResponse.json({
    volume: volumeRes.rows,
    byClient: clientRes.rows,
    bySupplier: supplierRes.rows,
    byConnectionType: connectionRes.rows,
    dlrSummary: dlrRes.rows,
    byChargingMode: chargingRes.rows,
  });
}
