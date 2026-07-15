import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { pool } from "@/db";

// GET /api/tenant/support-tickets — list all tickets for this tenant
export async function GET(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await pool.query(
    `SELECT t.*, 
      (SELECT COUNT(*) FROM support_ticket_replies r WHERE r.ticket_id = t.id) as reply_count
     FROM support_tickets t 
     WHERE t.tenant_id = $1 
     ORDER BY t.updated_at DESC`,
    [tenant.tenantId]
  );

  return NextResponse.json({ tickets: result.rows });
}

// POST /api/tenant/support-tickets — create a new support ticket
export async function POST(request: Request) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { subject, description, priority } = body;

  if (!subject || !description) {
    return NextResponse.json({ error: "Subject and description are required" }, { status: 400 });
  }

  const result = await pool.query(
    `INSERT INTO support_tickets (tenant_id, schema_name, subject, description, status, priority)
     VALUES ($1, $2, $3, $4, 'OPEN', $5)
     RETURNING *`,
    [tenant.tenantId, tenant.schemaName, subject, description, priority || "MEDIUM"]
  );

  // Auto-add the description as the first message
  await pool.query(
    `INSERT INTO support_ticket_replies (ticket_id, replied_by, replied_by_id, replied_by_name, message)
     VALUES ($1, 'tenant', $2, $3, $4)`,
    [result.rows[0].id, tenant.tenantId, tenant.companyName || tenant.email, description]
  );

  return NextResponse.json({ ticket: result.rows[0] }, { status: 201 });
}
