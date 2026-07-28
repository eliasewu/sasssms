/**
 * PM2 Health Monitor — Background service that periodically checks all servers'
 * /api/public/health endpoints and sends email alerts when PM2 goes down.
 *
 * Designed to run on the main server (Cloudflare origin). Checks all servers
 * listed in server-ips.ts, queries their health endpoints, and if any server
 * reports PM2 as "offline", sends an email alert.
 *
 * Deduplicates alerts: only re-alerts if the server has been down for > 5 minutes
 * (prevents spam from flapping).
 */

import { ALL_SERVER_IPS, serverLabel } from "@/lib/server-ips";
import nodemailer from "nodemailer";
import { getAdminEmailSync } from "@/lib/email-service";
const CHECK_INTERVAL_MS = 60_000; // every 60 seconds
const ALERT_COOLDOWN_MS = 5 * 60_000; // don't re-alert same server for 5 min

// ── Shared transporter (created once, reused for all alerts) ──
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "mail.net2app.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: parseInt(process.env.SMTP_PORT || "587") === 465,
  auth: {
    user: process.env.SMTP_USER || "noreply@net2app.com",
    pass: process.env.SMTP_PASS || "",
  },
});

interface Pm2HealthResult {
  ip: string;
  label: string;
  reachable: boolean;
  pm2Online: boolean;
  serverOnline: boolean;
  error?: string;
  checkedAt: string;
}

// Track last alert time per server to avoid spam
const lastAlertTime = new Map<string, number>();

// Detect self IP once at startup to skip hairpin NAT on self-check
let selfIp: string | null = null;
async function getSelfIp(): Promise<string | null> {
  if (selfIp !== null) return selfIp;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 2000);
    const r = await fetch("http://ifconfig.me/ip", { signal: ctl.signal });
    clearTimeout(t);
    selfIp = (await r.text()).trim();
  } catch {
    selfIp = "";
  }
  return selfIp;
}

async function checkOneServer(ip: string, port: number = 5556): Promise<Pm2HealthResult> {
  const label = serverLabel(ip);
  const result: Pm2HealthResult = {
    ip,
    label,
    reachable: false,
    pm2Online: false,
    serverOnline: false,
    checkedAt: new Date().toISOString(),
  };

  try {
    // For self-check, use 127.0.0.1 to avoid hairpin NAT issues
    const myIp = await getSelfIp();
    const targetIp = (myIp && myIp === ip) ? "127.0.0.1" : ip;

    const url = `http://${targetIp}:${port}/api/public/health`;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);

    if (res.ok) {
      const data = await res.json();
      result.reachable = true;
      result.serverOnline = true;
      result.pm2Online = data.pm2?.online === true;
    } else {
      result.reachable = true;
      result.serverOnline = false;
      result.error = `HTTP ${res.status}`;
    }
  } catch (e: any) {
    result.error = e.message || "Connection failed";
  }

  return result;
}

async function sendAlert(result: Pm2HealthResult, isDown: boolean, downtimeMs?: number): Promise<void> {
  const isRecovery = !isDown;
  const subject = isDown
    ? `🚨 PM2 DOWN: ${result.label} (${result.ip})`
    : `✅ PM2 RECOVERED: ${result.label} (${result.ip})`;
  const color = isDown ? "#d93025" : "#0d904f";

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:${color};">${isDown ? "🚨 PM2 Service Down" : "✅ PM2 Service Recovered"}</h2>
      <p><strong>Server:</strong> ${result.label}</p>
      <p><strong>IP:</strong> ${result.ip}</p>
      <p><strong>Time:</strong> ${result.checkedAt}</p>
      <p><strong>Server Reachable:</strong> ${result.reachable ? "✅ Yes" : "❌ No"}</p>
      <p><strong>PM2 Running:</strong> ${isDown ? "❌ No" : "✅ Yes"}</p>
      ${result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ""}
      ${downtimeMs ? `<p><strong>Downtime:</strong> ~${Math.round(downtimeMs / 60_000)} minute(s)</p>` : ""}
      ${isDown ? `
      <hr style="margin:20px 0" />
      <p style="color:#d93025;"><strong>Action Required:</strong> SSH into the server and run:</p>
      <pre style="background:#f5f5f5;padding:12px;border-radius:6px;">ssh ubuntu@${result.ip}
sudo pm2 restart net2app</pre>` : ""}
      <hr style="margin:20px 0" />
      <p style="color:#94a3b8;font-size:11px;">Net2APP Health Monitor — Auto-alert</p>
    </div>
  `;

  await transporter.sendMail({
    from: `"Net2APP Monitor" <${process.env.SMTP_USER || "noreply@net2app.com"}>`,
    to: getAdminEmailSync(),
    subject,
    html,
  });

  console.log(`[PM2-Monitor] ${isRecovery ? "Recovery" : "Alert"} sent: ${result.label} PM2 is ${isDown ? "DOWN" : "BACK ONLINE"}`);
}

export async function checkAllServersPm2(): Promise<Pm2HealthResult[]> {
  // Pre-cache self IP before parallel checks
  await getSelfIp();

  const results = await Promise.all(
    ALL_SERVER_IPS.map(ip => checkOneServer(ip))
  );

  // Check for PM2 down and send alerts (with cooldown)
  for (const result of results) {
    const key = result.ip;
    const lastAlert = lastAlertTime.get(key) || 0;
    const now = Date.now();

    if (!result.pm2Online && (now - lastAlert > ALERT_COOLDOWN_MS)) {
      try {
        await sendAlert(result, true);
        lastAlertTime.set(key, now);
      } catch (e) {
        console.error(`[PM2-Monitor] Failed to send alert for ${result.label}:`, e);
      }
    } else if (result.pm2Online && lastAlert > 0) {
      const downtimeMs = now - lastAlert;
      try {
        await sendAlert(result, false, downtimeMs);
      } catch (e) {
        console.error(`[PM2-Monitor] Failed to send recovery alert for ${result.label}:`, e);
      }
      lastAlertTime.delete(key);
    }
  }

  // Log summary
  const downCount = results.filter(r => !r.pm2Online).length;
  if (downCount > 0) {
    const downServers = results.filter(r => !r.pm2Online).map(r => r.label).join(", ");
    console.warn(`[PM2-Monitor] ${downCount} server(s) with PM2 down: ${downServers}`);
  }

  return results;
}

export function startPm2HealthMonitor(): NodeJS.Timeout {
  console.log(`[PM2-Monitor] Starting health checks every ${CHECK_INTERVAL_MS / 1000}s...`);

  // Run immediately on startup, then on interval
  checkAllServersPm2().catch(err => console.error("[PM2-Monitor] Initial check failed:", err));

  return setInterval(() => {
    checkAllServersPm2().catch(err => console.error("[PM2-Monitor] Check failed:", err));
  }, CHECK_INTERVAL_MS);
}
