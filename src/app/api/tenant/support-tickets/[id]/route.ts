import { NextResponse } from "next/server";
import { getTenantFromRequest } from "@/lib/auth";
import { pool } from "@/db";

// GET /api/tenant/support-tickets/[id] — get ticket with all replies
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const ticket = await pool.query(
    "SELECT * FROM support_tickets WHERE id = $1 AND tenant_id = $2",
    [id, tenant.tenantId]
  );
  if (ticket.rows.length === 0) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const replies = await pool.query(
    "SELECT * FROM support_ticket_replies WHERE ticket_id = $1 ORDER BY created_at ASC",
    [id]
  );

  return NextResponse.json({ ticket: ticket.rows[0], replies: replies.rows });
}

// POST /api/tenant/support-tickets/[id] — add a reply to a ticket
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const tenant = getTenantFromRequest(request);
  if (!tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json();
  const { message } = body;

  if (!message || !message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // Verify ticket belongs to this tenant
  const ticket = await pool.query(
    "SELECT * FROM support_tickets WHERE id = $1 AND tenant_id = $2",
    [id, tenant.tenantId]
  );
  if (ticket.rows.length === 0) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // Add reply
  const reply = await pool.query(
    `INSERT INTO support_ticket_replies (ticket_id, replied_by, replied_by_id, replied_by_name, message)
     VALUES ($1, 'tenant', $2, $3, $4) RETURNING *`,
    [id, tenant.tenantId, tenant.companyName || tenant.email, message.trim()]
  );

  // Update ticket: set replied_by and bump updated_at
  await pool.query(
    `UPDATE support_tickets SET replied_by = 'tenant', updated_at = NOW() WHERE id = $1`,
    [id]
  );

  return NextResponse.json({ reply: reply.rows[0] }, { status: 201 });
}
