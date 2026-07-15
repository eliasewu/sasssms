import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { pool } from "@/db";

async function getAdminName(adminId: number): Promise<string> {
  const r = await pool.query("SELECT name FROM super_admins WHERE id = $1", [adminId]);
  return r.rows[0]?.name || "Admin";
}

// GET /api/super/support-tickets — list all tickets across all tenants
export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const tenantId = url.searchParams.get("tenantId");

  let query = `
    SELECT t.*, tn.company_name as tenant_name, tn.email as tenant_email,
      (SELECT COUNT(*) FROM support_ticket_replies r WHERE r.ticket_id = t.id) as reply_count
    FROM support_tickets t
    JOIN tenants tn ON t.tenant_id = tn.id
  `;
  const params: (string | number)[] = [];
  const conditions: string[] = [];

  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (tenantId) {
    params.push(parseInt(tenantId));
    conditions.push(`t.tenant_id = $${params.length}`);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY t.updated_at DESC";

  const result = await pool.query(query, params);
  return NextResponse.json({ tickets: result.rows });
}

// PATCH /api/super/support-tickets — update ticket status
export async function PATCH(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { ticketId, status } = body;

  if (!ticketId || !status) {
    return NextResponse.json({ error: "ticketId and status are required" }, { status: 400 });
  }

  const validStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
  }

  const result = await pool.query(
    `UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, ticketId]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Add a system-style reply noting the status change
  const adminName = await getAdminName(admin.adminId);
  await pool.query(
    `INSERT INTO support_ticket_replies (ticket_id, replied_by, replied_by_id, replied_by_name, message)
     VALUES ($1, 'super', $2, $3, $4)`,
    [ticketId, admin.adminId, adminName, `📌 Status changed to ${status} by ${adminName}`]
  );

  return NextResponse.json({ ticket: result.rows[0] });
}
