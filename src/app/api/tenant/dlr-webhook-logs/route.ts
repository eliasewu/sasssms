import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { tenantQuery } from "@/lib/tenant-schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const messageId = url.searchParams.get("messageId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 500);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  let query = `SELECT l.id, l.message_id, l.dlr_status, l.pushed_to, l.http_status,
                      l.response, l.success, l.error, l.created_at,
                      c.name as client_name, c.id as client_id
               FROM dlr_webhook_logs l
               LEFT JOIN messages m ON m.message_id = l.message_id
               LEFT JOIN clients c ON c.id = m.client_id
               WHERE 1=1`;
  const params: (string | number)[] = [];
  let idx = 1;
  if (messageId) {
    query += ` AND l.message_id ILIKE $${idx++}`;
    params.push(`%${messageId}%`);
  }
  query += ` ORDER BY l.id DESC LIMIT $${idx++} OFFSET $${idx}`;
  params.push(limit, offset);

  let logs: unknown[] = [];
  let total = 0;
  try {
    const result = await tenantQuery(tenant.schemaName, query, params);
    logs = result.rows;

    let countQuery = `SELECT COUNT(*) as total FROM dlr_webhook_logs l WHERE 1=1`;
    const countParams: string[] = [];
    if (messageId) {
      countQuery += ` AND l.message_id ILIKE $1`;
      countParams.push(`%${messageId}%`);
    }
    const countResult = await tenantQuery(tenant.schemaName, countQuery, countParams);
    total = parseInt(countResult.rows[0]?.total || "0");
  } catch (err) {
    // Table may not exist yet (no DLR pushes since deploy) — return empty list
    console.error("[DLR-LOG] Read error:", err);
  }

  return NextResponse.json({ logs, total });
}
