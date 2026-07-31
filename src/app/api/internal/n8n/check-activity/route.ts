import { NextResponse } from "next/server";
import { db, pool } from "@/db";
import { tenants, paymentTransactions, supportTickets } from "@/db/schema";
import { sql, gte, eq, and } from "drizzle-orm";
import nodemailer from "nodemailer";
import { notifyTenantTicketReply } from "@/lib/email-service";

const INTERNAL_SECRET = process.env.INTERNAL_SYNC_SECRET || "net2app-internal-sync-2024";

/**
 * GET /api/internal/n8n/check-activity?since=2026-07-30T00:00:00Z
 *
 * Internal endpoint polled by n8n every 2 minutes.
 * Returns new tenants and completed payments since the given timestamp.
 * If new activity is found, sends an email alert to super admins.
 *
 * Auth: shared secret in header OR localhost-only (no auth needed for localhost).
 */
export async function GET(request: Request) {
  try {
    // ── Auth: localhost or shared secret ──
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "";
    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const host = request.headers.get("host") || "";
    const isLocalhost = !ip || ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || host.startsWith("localhost") || host.startsWith("127.0.0.1");

    if (!isLocalhost && token !== INTERNAL_SECRET) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Parse since parameter ──
    const url = new URL(request.url);
    const sinceParam = url.searchParams.get("since");
    if (!sinceParam) {
      return NextResponse.json({ error: "Missing 'since' query parameter (ISO timestamp)" }, { status: 400 });
    }

    const since = new Date(sinceParam);
    if (isNaN(since.getTime())) {
      return NextResponse.json({ error: "Invalid 'since' timestamp" }, { status: 400 });
    }

    // Clamp to last 24 hours max to prevent massive bulk alerts on first run
    const twentyFourHoursAgo = new Date(Date.now() - 86_400_000);
    if (since < twentyFourHoursAgo) {
      since.setTime(twentyFourHoursAgo.getTime());
    }

    // ── Query new tenants since timestamp ──
    const newTenants = await db
      .select({
        id: tenants.id,
        email: tenants.email,
        companyName: tenants.companyName,
        phone: tenants.phone,
        packageType: tenants.packageType,
        smsLimit: tenants.smsLimit,
        createdAt: tenants.createdAt,
      })
      .from(tenants)
      .where(gte(tenants.createdAt, since))
      .orderBy(sql`${tenants.createdAt} DESC`);

    // ── Query new completed payments since timestamp ──
    const newPayments = await db
      .select({
        id: paymentTransactions.id,
        tenantId: paymentTransactions.tenantId,
        amount: paymentTransactions.amount,
        smsAmount: paymentTransactions.smsAmount,
        paymentMethod: paymentTransactions.paymentMethod,
        packageType: paymentTransactions.packageType,
        status: paymentTransactions.status,
        createdAt: paymentTransactions.createdAt,
      })
      .from(paymentTransactions)
      .where(and(
        gte(paymentTransactions.createdAt, since),
        eq(paymentTransactions.status, "completed")
      ))
      .orderBy(sql`${paymentTransactions.createdAt} DESC`);

    // ── Fetch tenant emails for payments ──
    const tenantIds = [...new Set(newPayments.map((p) => p.tenantId))];
    const tenantMap = new Map<number, { email: string; companyName: string | null }>();
    if (tenantIds.length > 0) {
      const tList = await db
        .select({ id: tenants.id, email: tenants.email, companyName: tenants.companyName })
        .from(tenants)
        .where(sql`${tenants.id} IN (${sql.join(tenantIds.map(id => sql`${id}`), sql`,`)})`);
      for (const t of tList) {
        tenantMap.set(t.id, { email: t.email, companyName: t.companyName });
      }
    }

    // ── Query new support tickets since timestamp (OPEN = not yet addressed) ──
    const newTickets = await db
      .select({
        id: supportTickets.id,
        tenantId: supportTickets.tenantId,
        subject: supportTickets.subject,
        description: supportTickets.description,
        priority: supportTickets.priority,
        status: supportTickets.status,
        createdAt: supportTickets.createdAt,
        schemaName: supportTickets.schemaName,
      })
      .from(supportTickets)
      .where(and(
        gte(supportTickets.createdAt, since),
        eq(supportTickets.status, "OPEN")
      ))
      .orderBy(sql`${supportTickets.createdAt} DESC`);

    // ── Fetch tenant info for new tickets ──
    const ticketTenantIds = [...new Set(newTickets.map((t) => t.tenantId))];
    const ticketTenantMap = new Map<number, { email: string; companyName: string | null }>();
    if (ticketTenantIds.length > 0) {
      const tList = await db
        .select({ id: tenants.id, email: tenants.email, companyName: tenants.companyName })
        .from(tenants)
        .where(sql`${tenants.id} IN (${sql.join(ticketTenantIds.map(id => sql`${id}`), sql`,`)})`);
      for (const t of tList) {
        ticketTenantMap.set(t.id, { email: t.email, companyName: t.companyName });
      }
    }

    // ── Auto-reply to new tickets ──
    const autoRepliedTickets: { id: number; subject: string; tenantEmail: string; tenantName: string }[] = [];
    for (const ticket of newTickets) {
      try {
        const tInfo = ticketTenantMap.get(ticket.tenantId);
        const autoReplyMessage =
          "Thank you for contacting Net2APP Support.\n\n" +
          "We have received your support ticket and our team will review it shortly. " +
          "We aim to respond to all inquiries within 24 hours.\n\n" +
          "In the meantime, you can check your dashboard for updates on your ticket. " +
          "If you have any additional information to add, please reply to this ticket.\n\n" +
          "Best regards,\nNet2APP Support Team";

        // Insert auto-reply using raw SQL via pool (same pattern as existing support routes)
        await pool.query(
          `INSERT INTO support_ticket_replies (ticket_id, replied_by, replied_by_id, replied_by_name, message)
           VALUES ($1, 'super', 0, 'Auto-Responder', $2)`,
          [ticket.id, autoReplyMessage]
        );

        // Update ticket status
        await pool.query(
          `UPDATE support_tickets SET
             replied_by = 'super',
             status = 'IN_PROGRESS',
             updated_at = NOW()
           WHERE id = $1`,
          [ticket.id]
        );

        if (tInfo?.email) {
          autoRepliedTickets.push({
            id: ticket.id,
            subject: ticket.subject,
            tenantEmail: tInfo.email,
            tenantName: tInfo.companyName || "Valued Customer",
          });
        }
      } catch (replyErr) {
        console.error(`[n8n-check] Auto-reply failed for ticket #${ticket.id}:`, replyErr);
      }
    }

    // Fire-and-forget tenant email notifications for auto-replies
    for (const ar of autoRepliedTickets) {
      notifyTenantTicketReply({
        tenantEmail: ar.tenantEmail,
        tenantName: ar.tenantName,
        ticketId: ar.id,
        ticketSubject: ar.subject,
        replyMessage: "Thank you for contacting Net2APP Support. We have received your support ticket and will respond within 24 hours.",
        adminName: "Auto-Responder",
      }).catch(err => console.error("Auto-reply email failed:", err));
    }

    const hasNewTenants = newTenants.length > 0;
    const hasNewPayments = newPayments.length > 0;
    const hasNewTickets = newTickets.length > 0;

    // ── Send email alert if there's activity ──
    if (hasNewTenants || hasNewPayments || hasNewTickets) {
      const htmlEscape = (s: string | null | undefined): string =>
        (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

      const bodyLines: string[] = [
        "<h2>🔔 Net2APP Activity Alert</h2>",
        `<p>New activity detected since <strong>${since.toISOString()}</strong>:</p>`,
      ];

      if (hasNewTenants) {
        bodyLines.push("<h3>🆕 New Tenants</h3><ul>");
        for (const t of newTenants) {
          bodyLines.push(
            `<li><strong>${htmlEscape(t.companyName) || "Unknown"}</strong> — ${htmlEscape(t.email)} (${t.packageType || "Starter"})</li>`
          );
        }
        bodyLines.push(`<p>Total: ${newTenants.length} new tenant(s)</p>`);
      }

      if (hasNewPayments) {
        bodyLines.push("<h3>💳 New Payments</h3><ul>");
        for (const p of newPayments) {
          const tInfo = tenantMap.get(p.tenantId);
          const tenantEmail = tInfo?.email || `Tenant #${p.tenantId}`;
          const amount = parseFloat(p.amount || "0");
          const smsAmount = parseInt(String(p.smsAmount ?? 0), 10);
          bodyLines.push(
            `<li><strong>${htmlEscape(tenantEmail)}</strong> — $${amount.toFixed(2)} for ${smsAmount.toLocaleString()} SMS (${p.packageType || "N/A"})</li>`
          );
        }
        bodyLines.push(`<p>Total: ${newPayments.length} new payment(s)</p>`);
      }

      if (hasNewTickets) {
        bodyLines.push("<h3>🎫 New Support Tickets</h3><ul>");
        for (const t of newTickets) {
          const tInfo = ticketTenantMap.get(t.tenantId);
          const tenantName = htmlEscape(tInfo?.companyName || `Tenant #${t.tenantId}`);
          const subject = htmlEscape(t.subject);
          bodyLines.push(
            `<li><strong>#${t.id}: ${subject}</strong> — ${tenantName} (${t.priority}) <em>→ Auto-replied ✅</em></li>`
          );
        }
        bodyLines.push(`<p>Total: ${newTickets.length} new ticket(s) — auto-replied</p>`);
      }

      const htmlBody = bodyLines.join("\n");

      // Fetch super admin emails for the alert
      const superAdmins = await db.execute(
        sql`SELECT email FROM super_admins WHERE email IS NOT NULL`
      );
      const alertEmails = (superAdmins.rows as Array<{ email: string | null }>)
        .map((r) => r.email)
        .filter((e): e is string => Boolean(e));

      if (alertEmails.length > 0) {
        try {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || "127.0.0.1",
            port: parseInt(process.env.SMTP_PORT || "587"),
            secure: parseInt(process.env.SMTP_PORT || "587") === 465,
            auth: {
              user: process.env.SMTP_USER || "welcome@net2app.com",
              pass: process.env.SMTP_PASS || "",
            },
            tls: { rejectUnauthorized: false },
          });

          await transporter.sendMail({
            from: `"Net2APP Alerts" <${process.env.SMTP_USER || "welcome@net2app.com"}>`,
            to: alertEmails.join(","),
            subject: (() => {
              const parts: string[] = [];
              if (hasNewTenants) parts.push(`${newTenants.length} tenant(s)`);
              if (hasNewPayments) parts.push(`${newPayments.length} payment(s)`);
              if (hasNewTickets) parts.push(`${newTickets.length} ticket(s)`);
              return `🔔 Net2APP Alert: ${parts.join(", ")}`;
            })(),
            html: htmlBody,
          });

          console.log(`[n8n-check] Email alert sent to ${alertEmails.length} super admin(s)`);
        } catch (emailErr) {
          console.error("[n8n-check] Failed to send alert email:", emailErr);
        }
      }
    }

    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      since: since.toISOString(),
      tenants: newTenants,
      payments: newPayments,
      summary: {
        newTenants: newTenants.length,
        newPayments: newPayments.length,
        newTickets: newTickets.length,
        autoReplied: autoRepliedTickets.length,
        emailSent: hasNewTenants || hasNewPayments || hasNewTickets,
      },
      tickets: newTickets,
    });
  } catch (error: unknown) {
    console.error("[n8n-check] Error:", error);
    return NextResponse.json(
      { error: "Internal error", details: (error as Error).message },
      { status: 500 }
    );
  }
}
