/**
 * Supplier Unbind Alert — Peak & Off-Peak Monitoring
 *
 * Listens to supplier UNBOUND events on the bind event bus and sends
 * alerts to tenant admins. Behavior differs by time window:
 *
 *   PEAK HOURS (08:00-22:00 UTC):
 *     - Immediate SMS + email alert on first UNBOUND
 *     - Shorter cooldown (2 min) during peak to catch flaps
 *     - Dashboard alert created in public.alerts table
 *     - Escalation: if still UNBOUND after 5 min, re-alert
 *
 *   OFF-PEAK (22:00-08:00 UTC):
 *     - SMS only (no email)
 *     - Longer cooldown (10 min) to avoid waking people up
 *     - Dashboard alert still created for visibility
 *
 * Peak hours configurable via platform_settings:
 *   peak_hours_start / peak_hours_end (default: "08:00" / "22:00")
 */
import { bindEventBus, type BindEvent } from "@/lib/bind-event-bus";
import { sendTenantSms } from "@/lib/email-service";
import { createAlert } from "@/lib/service-monitor";
import { pool } from "@/db";

/** Default peak hours (UTC) */
const DEFAULT_PEAK_START = "08:00";
const DEFAULT_PEAK_END = "22:00";

/** Cooldown between UNBOUND alerts for the same supplier */
const PEAK_COOLDOWN_MS = 120_000;   // 2 minutes during peak
const OFFPEAK_COOLDOWN_MS = 600_000; // 10 minutes during off-peak

/** Escalation: if still UNBOUND after this during peak, re-alert */
const PEAK_ESCALATION_MS = 300_000; // 5 minutes

/** Track last alert timestamp, unbound start, and escalation timer per tenant:supplierId */
const lastAlertAt = new Map<string, number>();
const unboundSince = new Map<string, number>();
const escalationTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Periodic cleanup of stale unboundSince entries (older than 24h)
setInterval(() => {
  const cutoff = Date.now() - 86_400_000;
  for (const [key, ts] of unboundSince) {
    if (ts < cutoff) unboundSince.delete(key);
  }
}, 3600_000); // every hour

// ── Cached peak hours from platform_settings ──
let peakStart = DEFAULT_PEAK_START;
let peakEnd = DEFAULT_PEAK_END;
let peakSettingsLoaded = false;

async function loadPeakSettings(): Promise<void> {
  try {
    const { rows } = await pool.query(
      "SELECT key, value FROM platform_settings WHERE key IN ('peak_hours_start', 'peak_hours_end')"
    );
    for (const r of rows) {
      if (r.key === "peak_hours_start") peakStart = r.value || DEFAULT_PEAK_START;
      if (r.key === "peak_hours_end") peakEnd = r.value || DEFAULT_PEAK_END;
    }
  } catch { /* use defaults */ }
  peakSettingsLoaded = true; // always mark as loaded to prevent repeated DB queries on failure
}

/** Check if current UTC time falls within peak hours */
function isPeakHours(): boolean {
  try {
    const now = new Date();
    const currentMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    const [sh, sm] = peakStart.split(":").map(Number);
    const [eh, em] = peakEnd.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    // Handle overnight peak windows (e.g. start=22:00 end=06:00)
    if (startMins <= endMins) {
      return currentMinutes >= startMins && currentMinutes < endMins;
    }
    return currentMinutes >= startMins || currentMinutes < endMins;
  } catch {
    return true; // If parsing fails, assume peak (safer to alert)
  }
}



/**
 * Start listening for supplier UNBOUND events with peak-aware alerting.
 * Called once from instrumentation.ts at startup.
 */
export function startSupplierUnbindAlerts(): void {
  // Ensure peak settings are loaded before handling any event
  bindEventBus.onBindEvent((event: BindEvent) => {
    if (!peakSettingsLoaded) {
      loadPeakSettings()
        .catch(() => {}) // swallow error, use defaults
        .finally(() => {
          if (event.type === "supplier" && event.status === "UNBOUND") {
            handleSupplierUnbound(event).catch((err) => {
              console.error("[UnbindAlert] Error processing alert:", err);
            });
          }
        });
      return; // Wait for peak settings to load before processing
    }

    // Only alert on supplier UNBOUND events (not BOUND, not clients)
    if (event.type !== "supplier" || event.status !== "UNBOUND") return;

    handleSupplierUnbound(event).catch((err) => {
      console.error("[UnbindAlert] Error processing alert:", err);
    });
  });

  // Also listen for BOUND events to clear unbound-since tracking + escalation timers
  bindEventBus.onBindEvent((event: BindEvent) => {
    if (event.type !== "supplier" || event.status !== "BOUND") return;
    const key = `${event.tenantId}:${event.entityId}`;
    unboundSince.delete(key);
    const timer = escalationTimers.get(key);
    if (timer) { clearTimeout(timer); escalationTimers.delete(key); }
  });

  console.log("[UnbindAlert] Peak-aware supplier unbind alerts enabled (peak: 2min cooldown + email, off-peak: 10min SMS only)");
}

async function handleSupplierUnbound(event: BindEvent): Promise<void> {
  const cooldownKey = `${event.tenantId}:${event.entityId}`;
  const now = Date.now();
  const peak = isPeakHours();
  const cooldownMs = peak ? PEAK_COOLDOWN_MS : OFFPEAK_COOLDOWN_MS;
  const lastSent = lastAlertAt.get(cooldownKey);
  const unboundStart = unboundSince.get(cooldownKey) || now;

  // Track when this supplier first went unbound
  if (!unboundSince.has(cooldownKey)) {
    unboundSince.set(cooldownKey, now);
  }

  // Enforce cooldown — shorter during peak, longer off-peak
  if (lastSent && (now - lastSent) < cooldownMs) {
    // During peak: check for escalation (unbound > 5 min)
    if (peak && (now - unboundStart) > PEAK_ESCALATION_MS && (!lastSent || (now - lastSent) > PEAK_ESCALATION_MS)) {
      // Escalation: supplier still unbound after 5 min — re-alert
      console.log(`[UnbindAlert] ESCALATION: supplier ${event.entityId} unbound for ${Math.round((now - unboundStart) / 1000)}s during peak`);
    } else {
      return; // Cooldown active, no escalation needed
    }
  }

  const client = await pool.connect();
  try {
    // ── Look up supplier name ──
    await client.query(`SET search_path TO "${event.schemaName}"`);
    const { rows: suppRows } = await client.query(
      `SELECT name FROM suppliers WHERE id = $1 AND is_active = true`,
      [event.entityId]
    );
    const supplierName = suppRows.length > 0 ? suppRows[0].name : `Supplier #${event.entityId}`;

    // ── Look up tenant info ──
    await client.query(`SET search_path TO public`);
    const { rows: tenantRows } = await client.query(
      `SELECT company_name, phone, email FROM tenants WHERE id = $1`,
      [event.tenantId]
    );

    const tenantPhone = tenantRows.length > 0 ? tenantRows[0].phone : null;
    const tenantEmail = tenantRows.length > 0 ? tenantRows[0].email : null;
    const tenantName = tenantRows.length > 0 ? tenantRows[0].company_name : `Tenant ${event.tenantId}`;

    const timestamp = new Date(event.timestamp).toLocaleString("en-US", {
      timeZone: "UTC",
      hour12: false,
    });
    const duration = Math.round((now - unboundStart) / 1000);
    const peakLabel = peak ? "🔴 PEAK HOURS" : "🟡 OFF-PEAK";

    const message =
      `⚠️ Net2APP ${peakLabel}: SMPP supplier "${supplierName}" (ID: ${event.systemId}) ` +
      `went UNBOUND at ${timestamp} UTC` +
      (duration > 5 ? ` (down for ${duration}s)` : "") +
      `. Check your dashboard or contact support.`;

    // ── Dashboard alert (always, both peak and off-peak) ──
    await createAlert(
      `supplier_unbound:${event.tenantId}:${event.entityId}`,
      `Supplier "${supplierName}" went UNBOUND`,
      `${tenantName}'s SMPP supplier "${supplierName}" (${event.systemId}) disconnected at ${timestamp} UTC. ${peak ? "This is during peak hours — SMS delivery affected!" : "Off-peak — SMS delivery may be affected."}`,
      peak ? "error" : "warning"
    );

    // ── Peak escalation timer: re-check after 5 min if supplier is still UNBOUND ──
    if (peak) {
      const escKey = cooldownKey;
      const existingTimer = escalationTimers.get(escKey);
      if (existingTimer) clearTimeout(existingTimer);
      // Capture values for the timer closure
      const escTenantId = event.tenantId;
      const escSchema = event.schemaName;
      const escSupplierId = event.entityId;
      const escSupplierName = supplierName;
      const escSystemId = event.systemId;
      const escTenantName = tenantName;
      const escTenantPhone = tenantPhone;
      const escTenantEmail = tenantEmail;
      const escTimestamp = timestamp;
      escalationTimers.set(escKey, setTimeout(async () => {
        try {
          // Check if supplier is still actually unbound
          const checkClient = await pool.connect();
          let stillUnbound = false;
          try {
            await checkClient.query(`SET search_path TO "${escSchema}"`);
            const { rows } = await checkClient.query(
              `SELECT bind_status FROM suppliers WHERE id = $1`,
              [escSupplierId]
            );
            stillUnbound = rows.length > 0 && rows[0].bind_status !== "BOUND";
          } finally {
            try { await checkClient.query(`SET search_path TO public`); } catch {}
            checkClient.release();
          }
          if (!stillUnbound) { escalationTimers.delete(escKey); return; }

          console.log(`[UnbindAlert] ⏰ ESCALATION: supplier "${escSupplierName}" still UNBOUND after ${PEAK_ESCALATION_MS / 1000}s during peak`);
          const escMessage =
            `🚨 ESCALATED: Supplier "${escSupplierName}" (ID: ${escSystemId}) ` +
            `has been UNBOUND for ${PEAK_ESCALATION_MS / 60000} minutes during peak hours. ` +
            `SMS delivery through this supplier is blocked. Urgent action required.`;

          await createAlert(
            `supplier_unbound_escalated:${escTenantId}:${escSupplierId}`,
            `ESCALATED: Supplier "${escSupplierName}" still UNBOUND`,
            `${escTenantName}'s supplier "${escSupplierName}" has been disconnected for ${PEAK_ESCALATION_MS / 60000}+ minutes during peak hours.`,
            "error"
          );

          if (escTenantPhone) {
            await sendTenantSms(escTenantId, escSchema, escTenantPhone, escMessage).catch(() => {});
          }
          if (escTenantEmail) {
            try {
              const nodemailer = await import("nodemailer");
              const transporter = nodemailer.default.createTransport({
                host: process.env.SMTP_HOST || "mail.net2app.com",
                port: parseInt(process.env.SMTP_PORT || "587"),
                secure: parseInt(process.env.SMTP_PORT || "587") === 465,
                auth: { user: process.env.SMTP_USER || "welcome@net2app.com", pass: process.env.SMTP_PASS || "" },
                tls: { rejectUnauthorized: false }, // allow self-signed certs on localhost
              });
              await transporter.sendMail({
                from: `"Net2APP Alerts" <${process.env.SMTP_USER || "welcome@net2app.com"}>`,
                to: escTenantEmail,
                subject: `🚨 ESCALATED: Supplier "${escSupplierName}" UNBOUND for ${PEAK_ESCALATION_MS / 60000}min — ${escTenantName}`,
                html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:3px solid #991b1b;border-radius:8px;">
                  <h2 style="color:#991b1b;">🚨 ESCALATED: Peak Hours Supplier UNBOUND</h2>
                  <p><strong>Tenant:</strong> ${escTenantName}</p>
                  <p><strong>Supplier:</strong> ${escSupplierName} (${escSystemId})</p>
                  <p><strong>Disconnected since:</strong> ${escTimestamp} UTC</p>
                  <p><strong>Duration:</strong> ${PEAK_ESCALATION_MS / 60000}+ minutes</p>
                  <p style="color:#991b1b;font-size:16px;"><strong>⚠️ URGENT: This supplier has been down for ${PEAK_ESCALATION_MS / 60000}+ minutes during peak traffic. SMS delivery is severely impacted.</strong></p>
                  <hr style="margin:20px 0" />
                  <p style="color:#94a3b8;font-size:11px;">Net2APP Platform Monitoring | Reply STOP to unsubscribe</p>
                </div>`,
              });
            } catch { /* email best-effort */ }
          }
          escalationTimers.delete(escKey);
        } catch (err) {
          console.error("[UnbindAlert] Escalation check failed:", err);
        }
      }, PEAK_ESCALATION_MS));
    }

    // ── SMS alert (always, both peak and off-peak) ──
    if (tenantPhone) {
      console.log(
        `[UnbindAlert] ${peakLabel} Sending SMS to ${tenantName}: ` +
        `supplier "${supplierName}" UNBOUND → ${tenantPhone}`
      );
      const sent = await sendTenantSms(
        event.tenantId,
        event.schemaName,
        tenantPhone,
        message
      );
      if (sent) {
        lastAlertAt.set(cooldownKey, now);
        console.log(`[UnbindAlert] SMS sent to ${tenantPhone} for supplier "${supplierName}"`);
      } else {
        console.warn(`[UnbindAlert] SMS failed for ${tenantName}: no route to ${tenantPhone}`);
      }
    } else {
      console.warn(`[UnbindAlert] No phone for ${tenantName} — cannot send SMS`);
    }

    // ── Email alert (peak hours only — don't wake people up at night) ──
    if (peak && tenantEmail) {
      try {
        const nodemailer = await import("nodemailer");
        const transporter = nodemailer.default.createTransport({
          host: process.env.SMTP_HOST || "mail.net2app.com",
          port: parseInt(process.env.SMTP_PORT || "587"),
          secure: parseInt(process.env.SMTP_PORT || "587") === 465,
          auth: { user: process.env.SMTP_USER || "welcome@net2app.com", pass: process.env.SMTP_PASS || "" },
          tls: { rejectUnauthorized: false }, // allow self-signed certs on localhost
        });
        await transporter.sendMail({
          from: `"Net2APP Alerts" <${process.env.SMTP_USER || "welcome@net2app.com"}>`,
          to: tenantEmail,
          subject: `🔴 PEAK ALERT: Supplier "${supplierName}" UNBOUND — ${tenantName}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:2px solid #dc2626;border-radius:8px;">
            <h2 style="color:#dc2626;">🔴 Peak Hours Alert: Supplier UNBOUND</h2>
            <p><strong>Tenant:</strong> ${tenantName}</p>
            <p><strong>Supplier:</strong> ${supplierName} (${event.systemId})</p>
            <p><strong>Time:</strong> ${timestamp} UTC</p>
            <p><strong>Duration:</strong> ${duration}s and counting</p>
            <p style="color:#dc2626;"><strong>⚠️ This occurred during peak traffic hours. SMS delivery through this supplier is blocked until it reconnects.</strong></p>
            <hr style="margin:20px 0" />
            <p style="color:#94a3b8;font-size:11px;">Net2APP Platform Monitoring | Reply STOP to unsubscribe</p>
          </div>`,
        });
        console.log(`[UnbindAlert] PEAK email sent to ${tenantEmail} for supplier "${supplierName}"`);
      } catch (emailErr) {
        console.error("[UnbindAlert] Email send failed:", emailErr);
      }
    }
  } catch (err) {
    console.error("[UnbindAlert] DB lookup or send error:", err);
  } finally {
    try { await client.query(`SET search_path TO public`); } catch {}
    client.release();
  }
}
