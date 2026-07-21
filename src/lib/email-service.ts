import nodemailer from "nodemailer";
import { db, pool } from "@/db";
import { tenants, alerts } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { deliverSmsWithFallback } from "@/lib/smpp-client";
import type { RouteInfo } from "@/lib/smpp-client";

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "elias.ewu@gmail.com";
const SMTP_HOST = process.env.SMTP_HOST || "127.0.0.1";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "25");
const SMTP_USER = process.env.SMTP_USER || "noreply@net2app.com";
const SMTP_PASS = process.env.SMTP_PASS || "";

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  ...(SMTP_PASS ? { auth: { user: SMTP_USER, pass: SMTP_PASS } } : {}),
});

/**
 * Send payment notification to super admin when a tenant makes a payment
 */
export async function notifyAdminNewPayment(payload: {
  tenantName: string;
  tenantEmail: string;
  amount: string;
  paymentMethod: string;
  transactionId: number;
  gatewayLabel?: string;
}): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"Net2APP Payments" <${SMTP_USER}>`,
      to: SUPER_ADMIN_EMAIL,
      subject: `💰 New Payment: $${payload.amount} from ${payload.tenantName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a73e8;">New Payment Received</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Tenant:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${payload.tenantName} (${payload.tenantEmail})</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 18px; color: #0d904f;">$${payload.amount}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Method:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${payload.paymentMethod}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Gateway:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${payload.gatewayLabel || "N/A"}</td></tr>
            <tr><td style="padding: 8px;"><strong>Transaction ID:</strong></td><td style="padding: 8px;">#${payload.transactionId}</td></tr>
          </table>
          <p style="color: #666; margin-top: 20px;">Please review and approve this payment in the super admin dashboard.</p>
          <a href="https://net2app.com/super/dashboard/payments" style="display: inline-block; background: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Review Payment</a>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error("Failed to send admin payment notification:", e);
    return false;
  }
}

/**
 * Send payment confirmation to client after super admin approval
 */
export async function notifyClientPaymentApproved(payload: {
  clientEmail: string;
  clientName: string;
  amount: string;
  paymentMethod: string;
  transactionId: number;
  smsAdded?: number;
}): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"Net2APP Billing" <${SMTP_USER}>`,
      to: payload.clientEmail,
      subject: `✅ Payment Approved: $${payload.amount} - Net2APP`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0d904f;">Payment Approved! 🎉</h2>
          <p>Dear ${payload.clientName},</p>
          <p>Your payment of <strong>$${payload.amount}</strong> via ${payload.paymentMethod} has been approved.</p>
          ${payload.smsAdded ? `<p><strong>${payload.smsAdded.toLocaleString()} SMS credits</strong> have been added to your account.</p>` : ""}
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Transaction:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">#${payload.transactionId}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">$${payload.amount}</td></tr>
            <tr><td style="padding: 8px;"><strong>Method:</strong></td><td style="padding: 8px;">${payload.paymentMethod}</td></tr>
          </table>
          <p style="color: #666;">Thank you for choosing Net2APP!</p>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error("Failed to send client payment confirmation:", e);
    return false;
  }
}

/**
 * Send payment rejection notification to client
 */
export async function notifyClientPaymentRejected(payload: {
  clientEmail: string;
  clientName: string;
  amount: string;
  paymentMethod: string;
  reason?: string;
}): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"Net2APP Billing" <${SMTP_USER}>`,
      to: payload.clientEmail,
      subject: `Payment Review: $${payload.amount} - Net2APP`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d93025;">Payment Needs Attention</h2>
          <p>Dear ${payload.clientName},</p>
          <p>Your payment of <strong>$${payload.amount}</strong> via ${payload.paymentMethod} requires additional verification.</p>
          ${payload.reason ? `<p><strong>Reason:</strong> ${payload.reason}</p>` : ""}
          <p style="color: #666;">Please contact support or upload proof of payment in your dashboard.</p>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error("Failed to send client payment rejection:", e);
    return false;
  }
}

/**
 * Send email notification to tenant when super admin replies to their support ticket
 */
export async function notifyTenantTicketReply(payload: {
  tenantEmail: string;
  tenantName: string;
  ticketId: number;
  ticketSubject: string;
  replyMessage: string;
  adminName: string;
}): Promise<boolean> {
  try {
    const preview = payload.replyMessage.length > 200
      ? payload.replyMessage.slice(0, 200) + "..."
      : payload.replyMessage;

    await transporter.sendMail({
      from: `"Net2APP Support" <${SMTP_USER}>`,
      to: payload.tenantEmail,
      subject: `🔔 Support Reply: ${payload.ticketSubject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a73e8;">New Reply to Your Support Ticket</h2>
          <p>Dear ${payload.tenantName},</p>
          <p><strong>${payload.adminName}</strong> from Net2APP Support has replied to your ticket:</p>
          <div style="background: #f5f5f5; border-left: 4px solid #1a73e8; padding: 12px 16px; margin: 15px 0; border-radius: 4px;">
            <p style="margin: 0; color: #333;"><strong>Ticket #${payload.ticketId}: ${payload.ticketSubject}</strong></p>
            <p style="margin: 10px 0 0 0; color: #555; white-space: pre-wrap;">${preview}</p>
          </div>
          <p style="color: #666;">You can view the full reply and respond in your dashboard.</p>
          <a href="https://net2app.com/dashboard/support-tickets" style="display: inline-block; background: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">View Ticket</a>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">Thank you for using Net2APP!</p>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error("Failed to send support ticket reply notification:", e);
    return false;
  }
}

/**
 * Send package expiry warning to tenant (Professional/Enterprise)
 * Called 3 days before packageExpiresAt
 */
export async function notifyTenantPackageExpiring(payload: {
  tenantEmail: string;
  tenantName: string;
  packageType: string;
  expiresAt: string;
  daysLeft: number;
}): Promise<boolean> {
  try {
    const actionUrl = "https://net2app.com/dashboard/billing";
    await transporter.sendMail({
      from: `"Net2APP Billing" <${SMTP_USER}>`,
      to: payload.tenantEmail,
      subject: `⏰ ${payload.packageType} Plan Renews in ${payload.daysLeft} Days — Net2APP`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #e69500;">Your ${payload.packageType} Plan is Expiring Soon</h2>
          <p>Dear ${payload.tenantName},</p>
          <p>Your <strong>${payload.packageType}</strong> subscription will expire in <strong>${payload.daysLeft} day${payload.daysLeft > 1 ? "s" : ""}</strong> on <strong>${new Date(payload.expiresAt).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</strong>.</p>
          <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px 16px; margin: 15px 0; border-radius: 4px;">
            <p style="margin: 0; color: #856404;"><strong>⚠️ What happens if your plan expires?</strong></p>
            <ul style="margin: 8px 0 0 0; color: #856404;">
              <li>SMS sending will be paused</li>
              <li>Your data and settings will be preserved</li>
              <li>Reactivate anytime by renewing your plan</li>
            </ul>
          </div>
          <p style="color: #666;">To avoid service interruption, please renew your plan before the expiry date.</p>
          <a href="${actionUrl}" style="display: inline-block; background: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Renew Now →</a>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">Thank you for choosing Net2APP!</p>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error("Failed to send package expiry notification:", e);
    return false;
  }
}

/**
 * Send welcome email to newly created email account
 */
export async function sendWelcomeEmail(payload: {
  email: string;
  name: string;
  password: string;
}): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"Net2APP Mail" <${SMTP_USER}>`,
      to: payload.email,
      subject: `Welcome to Net2APP Mail — Your Account Details`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a73e8;">Welcome to Net2APP Mail!</h2>
          <p>Dear ${payload.name},</p>
          <p>Your email account has been created.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0; background: #f5f5f5; padding: 12px; border-radius: 8px;">
            <tr><td style="padding: 6px;"><strong>Email:</strong></td><td style="padding: 6px;">${payload.email}</td></tr>
            <tr><td style="padding: 6px;"><strong>Password:</strong></td><td style="padding: 6px; font-family: monospace;">${payload.password}</td></tr>
            <tr><td style="padding: 6px;"><strong>IMAP/SMTP:</strong></td><td style="padding: 6px;">mail.net2app.com</td></tr>
          </table>
          <p style="color: #666; font-size: 12px;">Please change your password after first login.</p>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error("Failed to send welcome email:", e);
    return false;
  }
}

/**
 * Send auto-renewal confirmation to tenant
 */
export async function notifyTenantAutoRenewed(payload: {
  tenantEmail: string;
  tenantName: string;
  packageType: string;
  amount: string;
  smsAdded: number;
  newExpiryDate: string;
  transactionId: number;
}): Promise<boolean> {
  try {
    const smsInfo = payload.packageType === "Enterprise"
      ? "Unlimited SMS (renewed)"
      : `${(payload.smsAdded / 1_000_000).toFixed(0)}M SMS credits added`;

    await transporter.sendMail({
      from: `"Net2APP Billing" <${SMTP_USER}>`,
      to: payload.tenantEmail,
      subject: `🔄 Auto-Renewed: ${payload.packageType} Plan — Net2APP`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0d904f;">Subscription Auto-Renewed! 🔄</h2>
          <p>Dear ${payload.tenantName},</p>
          <p>Your <strong>${payload.packageType}</strong> plan has been <strong>automatically renewed</strong> using your account balance.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Transaction:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">#${payload.transactionId}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee; font-size: 18px; color: #0d904f;">$${payload.amount}</td></tr>
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>SMS Credits:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${smsInfo}</td></tr>
            <tr><td style="padding: 8px;"><strong>Next Renewal:</strong></td><td style="padding: 8px;">${new Date(payload.newExpiryDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</td></tr>
          </table>
          <div style="background: #e8f5e9; border-left: 4px solid #4caf50; padding: 12px 16px; margin: 15px 0; border-radius: 4px;">
            <p style="margin: 0; color: #2e7d32;"><strong>✅ All set!</strong> Your service is active and SMS credits have been refreshed. No action needed.</p>
          </div>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">
            To disable auto-renewal, please contact support. Next auto-renewal will occur on ${new Date(payload.newExpiryDate).toLocaleDateString()}.
          </p>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error("Failed to send auto-renewal notification:", e);
    return false;
  }
}

/**
 * Send auto-renewal failure notification to tenant
 */
export async function notifyTenantAutoRenewFailed(payload: {
  tenantEmail: string;
  tenantName: string;
  packageType: string;
  monthlyFee: string;
  balance: string;
}): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"Net2APP Billing" <${SMTP_USER}>`,
      to: payload.tenantEmail,
      subject: `⚠️ Auto-Renewal Failed: ${payload.packageType} Plan — Net2APP`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d93025;">Auto-Renewal Failed</h2>
          <p>Dear ${payload.tenantName},</p>
          <p>We were unable to automatically renew your <strong>${payload.packageType}</strong> plan.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
            <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Monthly Fee:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">$${payload.monthlyFee}</td></tr>
            <tr><td style="padding: 8px;"><strong>Your Balance:</strong></td><td style="padding: 8px;">$${parseFloat(payload.balance).toFixed(2)}</td></tr>
          </table>
          <div style="background: #fce8e6; border-left: 4px solid #d93025; padding: 12px 16px; margin: 15px 0; border-radius: 4px;">
            <p style="margin: 0; color: #c5221f;"><strong>Insufficient balance.</strong> Please add funds and renew manually to restore service.</p>
          </div>
          <a href="https://net2app.com/dashboard/billing" style="display: inline-block; background: #1a73e8; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 10px;">Top Up & Renew →</a>
          <p style="color: #999; font-size: 12px; margin-top: 20px;">Your data and settings are preserved — service will resume after renewal.</p>
        </div>
      `,
    });
    return true;
  } catch (e) {
    console.error("Failed to send auto-renewal failure notification:", e);
    return false;
  }
}

/**
 * Scheduled check: find Professional/Enterprise tenants whose package expires
 * within 14, 7, or 3 days and send email notifications + create dashboard alerts.
 * Deduplicates via subscription_reminders table to prevent repeat sends.
 * Designed to be called daily via instrumentation setInterval.
 */
export async function checkPackageExpiry(): Promise<{ notified: number; errors: number }> {
  const now = new Date();

  // Reminder windows (days before expiry): 14, 7, 3
  // Query ranges allow ±1 day tolerance so a missed cron run still catches tenants
  const WINDOWS = [
    { daysBefore: 14, minDays: 13, maxDays: 15 },
    { daysBefore: 7,  minDays: 6,  maxDays: 8 },
    { daysBefore: 3,  minDays: 2,  maxDays: 4 },
  ];

  let notified = 0;
  let errors = 0;

  try {
    // Fetch all active Pro/Enterprise tenants with upcoming expiry
    const expiringTenants = await db
      .select({
        id: tenants.id,
        companyName: tenants.companyName,
        email: tenants.email,
        packageType: tenants.packageType,
        packageExpiresAt: tenants.packageExpiresAt,
      })
      .from(tenants)
      .where(
        and(
          sql`${tenants.packageType} IN ('professional', 'enterprise')`,
          sql`${tenants.packageExpiresAt} IS NOT NULL`,
          sql`${tenants.packageExpiresAt} > NOW()`,
          sql`${tenants.packageExpiresAt} <= NOW() + INTERVAL '15 days'`,
          eq(tenants.isActive, true),
        )
      );

    for (const t of expiringTenants) {
      if (!t.email || !t.packageExpiresAt) continue;

      const daysLeft = Math.max(1, Math.ceil((new Date(t.packageExpiresAt).getTime() - now.getTime()) / 86400000));

      // Determine which reminder window (if any) this tenant falls into
      const matchedWindow = WINDOWS.find(
        w => daysLeft >= w.minDays && daysLeft <= w.maxDays
      );
      if (!matchedWindow) continue; // outside all reminder windows

      // ── Dedup: check if a reminder for this window was already sent ──
      try {
        const existing = await db.execute(
          sql`SELECT 1 FROM subscription_reminders WHERE tenant_id = ${t.id} AND days_before = ${matchedWindow.daysBefore}`
        );
        if (existing.rows && existing.rows.length > 0) continue; // already notified for this window
      } catch { /* proceed — dedup failure shouldn't block notification */ }

      const pkgLabel = t.packageType === "enterprise" ? "Enterprise" : "Professional";

      // ── Send email notification ──
      try {
        const emailOk = await notifyTenantPackageExpiring({
          tenantEmail: t.email,
          tenantName: t.companyName,
          packageType: pkgLabel,
          expiresAt: String(t.packageExpiresAt),
          daysLeft,
        });
        if (!emailOk) errors++;
      } catch { errors++; }

      // ── Record the reminder to prevent duplicates ──
      try {
        await db.execute(
          sql`INSERT INTO subscription_reminders (tenant_id, days_before) VALUES (${t.id}, ${matchedWindow.daysBefore}) ON CONFLICT DO NOTHING`
        );
      } catch { /* non-blocking */ }

      // ── Create dashboard alert ──
      try {
        const alertMessage = `Your ${pkgLabel} plan expires in ${daysLeft} day${daysLeft > 1 ? "s" : ""} (${new Date(t.packageExpiresAt).toLocaleDateString()}). Renew to avoid service interruption.`;

        const existingAlert = await db
          .select({ id: alerts.id })
          .from(alerts)
          .where(
            and(
              eq(alerts.type, "package_expiry"),
              eq(alerts.isRead, false),
              sql`${alerts.createdAt} > NOW() - INTERVAL '24 hours'`,
              sql`${alerts.message} LIKE ${'%' + t.companyName + '%'}`,
            )
          )
          .limit(1);

        if (existingAlert.length === 0) {
          await db.insert(alerts).values({
            type: "package_expiry",
            title: `${pkgLabel} plan expiring for ${t.companyName}`,
            message: alertMessage,
            severity: matchedWindow.daysBefore <= 3 ? "critical" : "warning",
            isRead: false,
          });
        }
      } catch { /* non-critical */ }

      notified++;
    }
  } catch (err) {
    console.error("checkPackageExpiry failed:", err);
    errors++;
  }

  if (notified > 0 || errors > 0) {
    console.log(`[PackageExpiry] Notified: ${notified}, Errors: ${errors}`);
  }

  return { notified, errors };
}

/**
 * Send an SMS notification to a tenant using their own SMPP routes.
 * Looks up the tenant's schema for an active route/trunk/supplier combo
 * and delivers via deliverSmsWithFallback. Fire-and-forget — DLR is not tracked.
 */
async function sendTenantSms(
  tenantId: number,
  schemaName: string,
  phoneNumber: string,
  message: string
): Promise<boolean> {
  if (!phoneNumber || !schemaName) return false;

  const pgClient = await pool.connect();
  try {
    await pgClient.query(`SET search_path TO "${schemaName}"`);

    // Find the highest-priority active route with an active trunk and supplier
    const { rows } = await pgClient.query(`
      SELECT r.id as route_id, r.name as route_name,
             t.id as trunk_id, t.name as trunk_name,
             t.mcc_allow_list, t.mcc_deny_list,
             s.id as supplier_id, s.name as supplier_name,
             s.connection_type
      FROM routes r
      JOIN trunks t ON r.trunk_id = t.id AND t.is_active = true
      JOIN suppliers s ON t.supplier_id = s.id AND s.is_active = true
      WHERE r.is_active = true
      ORDER BY r.priority ASC
      LIMIT 1
    `);

    if (rows.length === 0) {
      console.log(`[SMS-Notify] Tenant ${tenantId}: no active routes with trunk+supplier`);
      return false;
    }

    const r = rows[0];
    const routes: RouteInfo[] = [{
      routeId: r.route_id as number,
      routeName: r.route_name as string,
      trunkId: r.trunk_id as number,
      trunkName: r.trunk_name as string,
      trunkMccAllowList: (r.mcc_allow_list as string) || null,
      trunkMccDenyList: (r.mcc_deny_list as string) || null,
      supplierId: r.supplier_id as number,
      supplierName: r.supplier_name as string,
      connectionType: r.connection_type as string,
      priority: 1,
    }];

    const messageId = "SYS_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

    const result = await deliverSmsWithFallback(
      tenantId,
      schemaName,
      0,          // clientId=0 (platform/system)
      "Net2APP",  // sender ID
      phoneNumber,
      message,
      messageId,
      routes,
    );

    if (result.success) {
      console.log(`[SMS-Notify] Sent to tenant ${tenantId}: "${message.slice(0, 40)}..."`);
    } else {
      console.warn(`[SMS-Notify] Failed for tenant ${tenantId}: ${result.errorMessage || "unknown"}`);
    }
    return result.success;
  } catch (err) {
    console.error(`[SMS-Notify] Error sending to tenant ${tenantId}:`, err);
    return false;
  } finally {
    try { await pgClient.query(`SET search_path TO public`); } catch {}
    pgClient.release();
  }
}

/**
 * Auto-renewal: find expired Professional/Enterprise tenants with sufficient
 * balance, deduct the monthly fee, extend packageExpiresAt by 1 month,
 * add SMS credits, create a COMPLETED transaction, send confirmation email + SMS.
 * Runs daily alongside checkPackageExpiry.
 */
export async function autoRenewSubscriptions(): Promise<{ renewed: number; failed: number; errors: number }> {
  let renewed = 0;
  let failed = 0;
  let errors = 0;      const PRO_SMS_CREDITS = 10_000_000;

  try {
    // Fetch expired Pro/Enterprise tenants (packageExpiresAt passed, not too old, auto-renew enabled)
    const expiredTenants = await db
      .select({
        id: tenants.id,
        companyName: tenants.companyName,
        email: tenants.email,
        phone: tenants.phone,
        schemaName: tenants.schemaName,
        packageType: tenants.packageType,
        monthlyFee: tenants.monthlyFee,
        balance: tenants.balance,
        packageExpiresAt: tenants.packageExpiresAt,
        smsLimit: tenants.smsLimit,
      })
      .from(tenants)
      .where(
        and(
          sql`${tenants.packageType} IN ('professional', 'enterprise')`,
          sql`${tenants.packageExpiresAt} IS NOT NULL`,
          sql`${tenants.packageExpiresAt} <= NOW()`,
          sql`${tenants.packageExpiresAt} >= NOW() - INTERVAL '3 days'`,
          eq(tenants.isActive, true),
          eq(tenants.autoRenewEnabled, true),
        )
      );

    for (const t of expiredTenants) {
      if (!t.email) continue;

      const pkgLabel = t.packageType === "enterprise" ? "Enterprise" : "Professional";
      const monthlyFee = String(t.monthlyFee || (t.packageType === "enterprise" ? "399" : "150"));
      const smsCredits = t.packageType === "enterprise" ? 0 : PRO_SMS_CREDITS;
      const feeAmount = parseFloat(monthlyFee);
      const currentBalance = parseFloat(String(t.balance || "0"));
      const packageExpiry = new Date();
      packageExpiry.setMonth(packageExpiry.getMonth() + 1);

      // ── Dedup: check if already auto-renewed today ──
      try {
        const existing = await db.execute(
          sql`SELECT 1 FROM subscription_reminders WHERE tenant_id = ${t.id} AND days_before = 0`
        );
        if (existing.rows && existing.rows.length > 0) continue;
      } catch { /* proceed */ }

      // ── Check balance ──
      if (currentBalance < feeAmount) {
        // Insufficient balance — send failure notification (once)
        try {
          const alreadyNotified = await db.execute(
            sql`SELECT 1 FROM subscription_reminders WHERE tenant_id = ${t.id} AND days_before = -1`
          );
          if (!alreadyNotified.rows || alreadyNotified.rows.length === 0) {
            // ── Send email ──
            await notifyTenantAutoRenewFailed({
              tenantEmail: t.email,
              tenantName: t.companyName,
              packageType: pkgLabel,
              monthlyFee,
              balance: String(t.balance || "0"),
            });
            // ── Send SMS ──
            if (t.phone) {
              const smsMsg = `Net2APP: Auto-renewal failed for your ${pkgLabel} plan. ` +
                `Insufficient balance ($${parseFloat(String(t.balance || "0")).toFixed(2)} / $${monthlyFee} needed). ` +
                `Top up at net2app.com/dashboard/billing`;
              sendTenantSms(t.id, t.schemaName!, t.phone, smsMsg).catch(() => {});
            }
            await db.execute(
              sql`INSERT INTO subscription_reminders (tenant_id, days_before) VALUES (${t.id}, -1) ON CONFLICT DO NOTHING`
            );
          }
        } catch { errors++; }
        failed++;
        continue;
      }

      // ── Deduct balance + extend expiry + add SMS credits in ONE update ──
      const newBalance = (currentBalance - feeAmount).toFixed(4);
      const currentLimit = parseInt(String(t.smsLimit || "0")) || 0;
      const newLimit = smsCredits > 0 ? currentLimit + smsCredits : 0;

      await db.update(tenants).set({
        balance: newBalance,
        packageExpiresAt: packageExpiry,
        smsLimit: newLimit,
        lastRechargeAt: new Date(),
        lastRechargeAmount: monthlyFee,
        updatedAt: new Date(),
      } as any).where(eq(tenants.id, t.id));

      // ── Record the auto-renewal to prevent duplicates ──
      try {
        await db.execute(
          sql`INSERT INTO subscription_reminders (tenant_id, days_before) VALUES (${t.id}, 0) ON CONFLICT DO NOTHING`
        );
      } catch { errors++; }

      // ── Create payment transaction ──
      let txnId = 0;
      try {
        const txnResult = await db.execute(
          sql`INSERT INTO payment_transactions (tenant_id, amount, payment_method, status, package_type, sms_amount, metadata, client_email)
              VALUES (${t.id}, ${monthlyFee}, 'auto_renew', 'COMPLETED', ${t.packageType || 'professional'},
                      ${smsCredits}, ${JSON.stringify({ autoRenew: true, newExpiry: packageExpiry.toISOString() })}, ${t.email})
              RETURNING id`
        );
        if (txnResult.rows && txnResult.rows.length > 0) {
          txnId = (txnResult.rows[0] as any).id || 0;
        }
      } catch { errors++; }

      // ── Send confirmation email ──
      try {
        await notifyTenantAutoRenewed({
          tenantEmail: t.email,
          tenantName: t.companyName,
          packageType: pkgLabel,
          amount: monthlyFee,
          smsAdded: smsCredits,
          newExpiryDate: packageExpiry.toISOString(),
          transactionId: txnId,
        });
      } catch { errors++; }

      // ── Send SMS notification ──
      if (t.phone) {
        const smsInfo = pkgLabel === "Enterprise"
          ? "Unlimited SMS."
          : `${(smsCredits / 1_000_000).toFixed(0)}M SMS credits added.`;
        const smsMsg = `Net2APP: Your ${pkgLabel} plan auto-renewed for $${monthlyFee}. ` +
          `${smsInfo} Next renewal: ${packageExpiry.toLocaleDateString()}. Txn #${txnId}`;
        sendTenantSms(t.id, t.schemaName!, t.phone, smsMsg).catch(() => {});
      }

      // ── Create dashboard alert ──
      try {
        await db.insert(alerts).values({
          type: "auto_renew",
          title: `${pkgLabel} plan auto-renewed for ${t.companyName}`,
          message: `${pkgLabel} plan auto-renewed at $${monthlyFee}. Next renewal: ${packageExpiry.toLocaleDateString()}.`,
          severity: "info",
          isRead: false,
        });
      } catch { /* non-critical */ }

      renewed++;
    }
  } catch (err) {
    console.error("autoRenewSubscriptions failed:", err);
    errors++;
  }

  if (renewed > 0 || failed > 0 || errors > 0) {
    console.log(`[AutoRenew] Renewed: ${renewed}, Failed: ${failed}, Errors: ${errors}`);
  }

  return { renewed, failed, errors };
}
