import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const status = url.searchParams.get("status");
  const campaignId = url.searchParams.get("campaignId");
  const limit = parseInt(url.searchParams.get("limit") || "50");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  const source = url.searchParams.get("source"); // "test", "client", "campaign"

  let query = `SELECT m.*, c.name as client_name FROM messages m LEFT JOIN clients c ON m.client_id = c.id WHERE 1=1`;
  const params: (string | number)[] = [];
  let idx = 1;

  if (clientId) { query += ` AND m.client_id = $${idx++}`; params.push(clientId); }
  if (status) { query += ` AND m.status = $${idx++}`; params.push(status); }
  if (campaignId) { query += ` AND m.campaign_id = $${idx++}`; params.push(campaignId); }
  
  // Filter by source type
  if (source === "test") { query += ` AND m.connection_type IS NULL AND m.content LIKE '%Test%'`; }
  else if (source === "campaign") { query += ` AND m.campaign_id IS NOT NULL`; }
  else if (source === "client") { query += ` AND m.campaign_id IS NULL`; }

  query += ` ORDER BY m.id DESC LIMIT $${idx++} OFFSET $${idx}`;
  params.push(limit, offset);

  const result = await tenantQuery(tenant.schemaName, query, params);

  // Get total count
  let countQuery = `SELECT COUNT(*) as total FROM messages WHERE 1=1`;
  const countParams: (string | number)[] = [];
  let cidx = 1;
  if (clientId) { countQuery += ` AND client_id = $${cidx++}`; countParams.push(clientId); }
  if (status) { countQuery += ` AND status = $${cidx++}`; countParams.push(status); }

  const countResult = await tenantQuery(tenant.schemaName, countQuery, countParams);

  return NextResponse.json({
    messages: result.rows,
    total: parseInt(countResult.rows[0]?.total || "0"),
  });
}
