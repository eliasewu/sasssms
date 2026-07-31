import { NextResponse } from "next/server";
import { pool } from "@/db";

const INTERNAL_SECRET = process.env.INTERNAL_SYNC_SECRET || "net2app-internal-sync-2024";

/**
 * GET /api/internal/n8n/tickets-for-ai
 *
 * Internal endpoint polled by n8n's AI Agent workflow.
 * Returns OPEN support tickets (sorted by priority then age) plus the list of
 * super admins so the AI can analyse and suggest which admin should handle each
 * ticket.
 *
 * Auth: localhost-only or shared secret (same pattern as check-activity).
 */
export async function GET(request: Request) {
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

    // ── 1. Fetch OPEN support tickets with tenant info ──
    const ticketsResult = await pool.query(`
      SELECT
        t.id,
        t.tenant_id,
        t.schema_name,
        t.subject,
        t.description,
        t.priority,
        t.status,
        t.created_at,
        t.updated_at,
        tn.company_name AS tenant_name,
        tn.email AS tenant_email,
        tn.phone AS tenant_phone,
        tn.package_type AS tenant_package,
        tn.server_location AS tenant_server,
        (SELECT COUNT(*) FROM support_ticket_replies r WHERE r.ticket_id = t.id) AS reply_count,
        (SELECT r2.replied_by_name FROM support_ticket_replies r2
         WHERE r2.ticket_id = t.id ORDER BY r2.created_at DESC LIMIT 1) AS last_reply_by
      FROM support_tickets t
      JOIN tenants tn ON t.tenant_id = tn.id
      WHERE t.status = 'OPEN'
      ORDER BY
        CASE t.priority
          WHEN 'URGENT'  THEN 1
          WHEN 'HIGH'    THEN 2
          WHEN 'MEDIUM'  THEN 3
          WHEN 'LOW'     THEN 4
          ELSE 5
        END ASC,
        t.created_at ASC
    `);

    // ── 2. Fetch active super admins for AI to assign to ──
    const adminsResult = await pool.query(`
      SELECT id, email, name, is_active
      FROM super_admins
      WHERE is_active = true
      ORDER BY name ASC
    `);

    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      total: ticketsResult.rows.length,
      tickets: ticketsResult.rows.map((t: Record<string, unknown>) => ({
        id: t.id,
        subject: t.subject,
        description: t.description,
        priority: t.priority,
        status: t.status,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        replyCount: t.reply_count,
        lastReplyBy: t.last_reply_by,
        tenant: {
          id: t.tenant_id,
          name: t.tenant_name,
          email: t.tenant_email,
          phone: t.tenant_phone,
          package: t.tenant_package,
          server: t.tenant_server,
        },
      })),
      admins: adminsResult.rows.map((a: Record<string, unknown>) => ({
        id: a.id,
        name: a.name,
        email: a.email,
      })),
    });
  } catch (error: unknown) {
    console.error("[tickets-for-ai] Error:", error);
    return NextResponse.json(
      { error: "Internal error", details: (error as Error).message },
      { status: 500 }
    );
  }
}
