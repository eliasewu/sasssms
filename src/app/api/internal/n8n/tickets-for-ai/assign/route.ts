import { NextResponse } from "next/server";
import { pool } from "@/db";

const INTERNAL_SECRET = process.env.INTERNAL_SYNC_SECRET || "net2app-internal-sync-2024";

/**
 * POST /api/internal/n8n/tickets-for-ai/assign
 *
 * Called by the n8n AI Agent workflow after analysing a support ticket.
 * Records the AI's suggested assignment as an internal note/reply on the ticket
 * and bumps the status to IN_PROGRESS so the ticket isn't re-processed.
 *
 * Auth: localhost-only or shared secret.
 */
export async function POST(request: Request) {
  try {
    // ── Auth ──
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") || "";
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const host = request.headers.get("host") || "";
    const isLocalhost = !ip || ip === "127.0.0.1" || ip === "::1" || ip === "localhost" ||
      host.startsWith("localhost") || host.startsWith("127.0.0.1");
    if (!isLocalhost && token !== INTERNAL_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Parse body ──
    const body = await request.json();
    const { ticketId, assignedTo, reason } = body;

    if (!ticketId || !assignedTo) {
      return NextResponse.json(
        { error: "ticketId and assignedTo are required" },
        { status: 400 }
      );
    }

    // Verify the ticket exists and is OPEN
    const ticket = await pool.query(
      `SELECT id, subject, status FROM support_tickets WHERE id = $1`,
      [ticketId]
    );
    if (ticket.rows.length === 0) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (ticket.rows[0].status !== "OPEN") {
      return NextResponse.json({
        skipped: true,
        message: `Ticket #${ticketId} is already ${ticket.rows[0].status} — skipping`,
        ticketId,
      });
    }

    // Build the assignment message
    const reasonText = reason
      ? `\nReason: ${reason}`
      : "";
    const message =
      `🤖 AI Assignment: Assigned to **${assignedTo}**${reasonText}\n\n` +
      `_This is an automated assignment by the AI Agent workflow._`;

    // Insert the reply and update ticket status in a transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `INSERT INTO support_ticket_replies (ticket_id, replied_by, replied_by_id, replied_by_name, message)
         VALUES ($1, 'super', 0, 'AI Agent', $2)`,
        [ticketId, message]
      );

      await client.query(
        `UPDATE support_tickets SET status = 'IN_PROGRESS', replied_by = 'super', updated_at = NOW()
         WHERE id = $1`,
        [ticketId]
      );

      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        ticketId,
        assignedTo,
        message: `Ticket #${ticketId} assigned to ${assignedTo}`,
      });
    } catch (dbErr) {
      await client.query("ROLLBACK");
      throw dbErr;
    } finally {
      client.release();
    }
  } catch (error: unknown) {
    console.error("[tickets-for-ai/assign] Error:", error);
    return NextResponse.json(
      { error: "Internal error", details: (error as Error).message },
      { status: 500 }
    );
  }
}
