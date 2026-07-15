import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { pool } from "@/db";

async function getAdminName(adminId: number): Promise<string> {
  const r = await pool.query("SELECT name FROM super_admins WHERE id = $1", [adminId]);
  return r.rows[0]?.name || "Admin";
}

// GET /api/super/support-tickets/[id] — get ticket with all replies
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const ticket = await pool.query(
    `SELECT t.*, tn.company_name as tenant_name, tn.email as tenant_email
     FROM support_tickets t
     JOIN tenants tn ON t.tenant_id = tn.id
     WHERE t.id = $1`,
    [id]
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

// POST /api/super/support-tickets/[id] — add a reply from super admin
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await request.json();
  const { message } = body;

  if (!message || !message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // Verify ticket exists
  const ticket = await pool.query("SELECT * FROM support_tickets WHERE id = $1", [id]);
  if (ticket.rows.length === 0) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const adminName = await getAdminName(admin.adminId);

  // Add reply
  const reply = await pool.query(
    `INSERT INTO support_ticket_replies (ticket_id, replied_by, replied_by_id, replied_by_name, message)
     VALUES ($1, 'super', $2, $3, $4) RETURNING *`,
    [id, admin.adminId, adminName, message.trim()]
  );

  // Update ticket: set replied_by and bump updated_at
  // Auto-set to IN_PROGRESS if currently OPEN (first super response)
  await pool.query(
    `UPDATE support_tickets SET 
       replied_by = 'super', 
       status = CASE WHEN status = 'OPEN' THEN 'IN_PROGRESS' ELSE status END,
       updated_at = NOW() 
     WHERE id = $1`,
    [id]
  );

  return NextResponse.json({ reply: reply.rows[0] }, { status: 201 });
}
