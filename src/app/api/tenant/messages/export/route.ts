/**
 * GET /api/tenant/messages/export
 *
 * Downloads the tenant's SMS logs as a CSV file (Excel-friendly).
 * Honors the same filters as the SMS Logs list page and includes the real
 * Msg ID (message_id) and Supplier ID (supplier_message_id) columns.
 *
 * Query params (all optional):
 *   clientId, status, connectionType, campaignId, source, limit
 */
import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";
import { batchEnrichMccMnc } from "@/lib/rates";
import { enrichBusinessApiNames } from "@/lib/business-api-send";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50_000;
const MAX_LIMIT = 50_000;
// MCC/MNC enrichment joins every candidate number against the MCC database;
// for very large exports it is skipped (columns left blank) to avoid a slow
// query and heavy memory use.
const ENRICH_MAX_ROWS = 20_000;

/**
 * Escape a value for CSV. Defends against both quoting (commas/quotes/newlines)
 * AND formula injection (CWE-1236): cells starting with =, +, -, @, tab or
 * CR get a leading apostrophe so Excel treats them as text, not formulas.
 */
function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const status = url.searchParams.get("status");
  const connectionType = url.searchParams.get("connectionType");
  const campaignId = url.searchParams.get("campaignId");
  const source = url.searchParams.get("source");
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT)) || DEFAULT_LIMIT,
    MAX_LIMIT
  );

  // Same query + filters as the SMS Logs list page (/api/tenant/messages)
  let query = `SELECT m.*, c.name as client_name,
    rp.name as route_plan_name, r.name as route_name,
    t.name as trunk_name, s.name as supplier_name
    FROM messages m
    LEFT JOIN clients c ON m.client_id = c.id
    LEFT JOIN route_plans rp ON m.route_plan_id = rp.id
    LEFT JOIN routes r ON m.route_id = r.id
    LEFT JOIN trunks t ON m.trunk_id = t.id
    LEFT JOIN suppliers s ON m.supplier_id = s.id
    WHERE 1=1`;
  const params: (string | number)[] = [];
  let idx = 1;

  if (clientId) { query += ` AND m.client_id = $${idx++}`; params.push(clientId); }
  if (status) { query += ` AND m.status = $${idx++}`; params.push(status); }
  if (campaignId) { query += ` AND m.campaign_id = $${idx++}`; params.push(campaignId); }
  if (connectionType) { query += ` AND m.connection_type = $${idx++}`; params.push(connectionType); }
  if (source === "test") { query += ` AND m.connection_type IS NULL AND m.content LIKE '%Test%'`; }
  else if (source === "campaign") { query += ` AND m.campaign_id IS NOT NULL`; }
  else if (source === "client") { query += ` AND m.campaign_id IS NULL`; }

  query += ` ORDER BY m.id DESC LIMIT $${idx++}`;
  params.push(limit);

  const result = await tenantQuery(tenant.schemaName, query, params);

  // Batch-enrich MCC/MNC using original_destination (same as the list page) —
  // but skip for very large exports where the join would be slow.
  const rows = result.rows as Record<string, unknown>[];
  const dests = rows.map(
    (m) => (m.original_destination as string) || (m.destination as string) || ""
  );
  const enrichedMap =
    dests.length <= ENRICH_MAX_ROWS ? await batchEnrichMccMnc(dests) : new Map();

  // Resolve Business API connectors (supplier config → business_api_connect)
  // so the CSV "Connection Type" column shows the provider/connector name.
  // Skipped for very large exports (same cap as MCC enrichment).
  const rowsWithConnectors =
    rows.length <= ENRICH_MAX_ROWS
      ? await enrichBusinessApiNames(tenant.schemaName, rows)
      : rows;

  // ── Build CSV ──
  const headers = [
    "ID", "Msg ID", "Supplier ID", "Consumer", "Alias", "Sender", "Recipients",
    "Content", "MCC", "MNC", "Rate", "Supplier Cost", "Profit", "Route",
    "Channel", "Supplier", "Connection Type", "Status", "DLR Status", "DLR Source", "DLR Time", "Created At",
  ];

  const lines: string[] = [headers.map(csvCell).join(",")];
  for (const m of rowsWithConnectors) {
    const enriched = enrichedMap.get(
      (m.original_destination as string) || (m.destination as string) || ""
    );
    const recipients = ((m.original_destination as string) || (m.destination as string) || "").replace(/^\+/, "");
    lines.push(
      [
        m.id,
        m.message_id,
        m.supplier_message_id || "",
        m.client_name || `CL_${m.client_id || 0}`,
        m.client_name || `CL_${m.client_id || 0}`,
        m.sender,
        recipients,
        m.content,
        enriched?.mcc || "",
        enriched?.mnc || "",
        m.cost || 0,
        m.supplier_cost || 0,
        m.profit || 0,
        m.route_name || `Route #${m.route_id || 0}`,
        (m.business_api_name as string) || m.trunk_name || `Trunk #${m.trunk_id || 0}`,
        m.supplier_name || `Supplier #${m.supplier_id || 0}`,
        (m.business_api_name as string) || m.connection_type || "",
        m.status || "",
        m.dlr_status || "",
        m.dlr_source || "",
        m.dlr_timestamp || "",
        m.created_at || "",
      ].map(csvCell).join(",")
    );
  }

  const csv = "\uFEFF" + lines.join("\r\n"); // BOM so Excel opens UTF-8 correctly
  // NOTE: never write this as a literal character-class regex in this file —
  // Tailwind's content scanner reads it as a class name and emits invalid CSS
  // that breaks the build. Three bracket-free replaces are equivalent.
  const stamp = new Date().toISOString().slice(0, 16).replaceAll("-", "").replaceAll(":", "").replaceAll("T", "");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="net2app-sms-logs-${stamp}.csv"`,
    },
  });
}
