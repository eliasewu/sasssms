/**
 * Billing & Invoicing Service
 *
 * Per-tenant invoicing engine: sequential invoice numbers, MCC/network line
 * items, bank/payment details, SMTP email delivery, dashboard alerts, and
 * HTML / Excel / PDF invoice rendering (matching the sample invoice layout).
 */
import nodemailer from "nodemailer";
import * as XLSX from "xlsx";
import { pool, db } from "@/db";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SmtpConfig {
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  fromEmail: string | null;
  fromName: string | null;
  encryption: string | null;
  isActive: boolean;
}

export interface InvoiceSettings {
  id: number;
  currency: string;
  timezone: string;
  taxRate: number;
  dueDays: number;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  defaultBankAccountId: number | null;
  autoEmailInvoice: boolean;
  notifyRateChange: boolean;
  notifyLowBalance: boolean;
  welcomeEmailAuto: boolean;
}

export interface LineItem {
  network: string;
  country: string;
  mcc: string;
  totalSms: number;
  rate: number;
  totalCharge: number;
  remarks: string;
}

export interface TenantInfo {
  id: number;
  schemaName: string;
  companyName: string;
  email: string;
  smppServerIp: string | null;
  smppServerPort: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// SMTP helpers (per-tenant, falls back to process.env)
// ─────────────────────────────────────────────────────────────────────────────

const ENV_SMTP = {
  host: process.env.SMTP_HOST || "127.0.0.1",
  port: parseInt(process.env.SMTP_PORT || "25"),
  user: process.env.SMTP_USER || "welcome@net2app.com",
  pass: process.env.SMTP_PASS || "",
};

export async function getSmtpConfig(schemaName: string): Promise<SmtpConfig> {
  try {
    const r = await pool.query(
      `SELECT host, port, username, password, from_email, from_name, encryption, is_active
       FROM "${schemaName}".smtp_config ORDER BY id LIMIT 1`
    );
    const row = r.rows[0];
    if (row && row.host) {
      return {
        host: row.host,
        port: parseInt(row.port) || 587,
        username: row.username || null,
        password: row.password || null,
        fromEmail: row.from_email || null,
        fromName: row.from_name || null,
        encryption: row.encryption || "tls",
        isActive: row.is_active !== false,
      };
    }
  } catch {
    /* tenant schema may not exist yet — fall through to env */
  }
  return {
    host: ENV_SMTP.host,
    port: ENV_SMTP.port,
    username: null,
    password: ENV_SMTP.pass || null,
    fromEmail: ENV_SMTP.user,
    fromName: "Net2APP",
    encryption: ENV_SMTP.port === 465 ? "ssl" : "tls",
    isActive: true,
  };
}

function buildTransporter(cfg: SmtpConfig) {
  const secure = cfg.encryption === "ssl" || cfg.port === 465;
  const auth = cfg.username
    ? { user: cfg.username, pass: cfg.password || "" }
    : cfg.password
    ? { user: cfg.username || cfg.fromEmail || ENV_SMTP.user, pass: cfg.password }
    : undefined;
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure,
    ...(auth ? { auth } : {}),
    tls: { rejectUnauthorized: false },
  });
}

export async function sendTenantEmail(
  schemaName: string,
  opts: { to: string; subject: string; html: string; attachments?: { filename: string; content: Buffer | string; contentType?: string }[] }
): Promise<boolean> {
  try {
    const cfg = await getSmtpConfig(schemaName);
    const transporter = buildTransporter(cfg);
    const fromEmail = cfg.fromEmail || ENV_SMTP.user;
    const fromName = cfg.fromName || "Net2APP";
    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      ...(opts.attachments ? { attachments: opts.attachments } : {}),
    });
    return true;
  } catch (e) {
    console.error(`[billing] SMTP send failed (${schemaName}):`, (e as Error).message);
    return false;
  }
}

/** Insert a dashboard alert into the tenant's own alerts table. */
export async function createDashboardAlert(
  schemaName: string,
  type: string,
  title: string,
  message: string,
  severity: "info" | "warning" | "critical" = "info"
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO "${schemaName}".alerts (type, title, message, severity, is_read)
       VALUES ($1, $2, $3, $4, false)`,
      [type, title, message, severity]
    );
  } catch (e) {
    console.error(`[billing] alert insert failed (${schemaName}):`, (e as Error).message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tenant / settings helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function getTenantInfo(tenantId: number): Promise<TenantInfo | null> {
  const rows = await db
    .select({
      id: tenants.id,
      schemaName: tenants.schemaName,
      companyName: tenants.companyName,
      email: tenants.email,
      smppServerIp: tenants.smppServerIp,
      smppServerPort: tenants.smppServerPort,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);
  if (rows.length === 0) return null;
  return {
    id: rows[0].id,
    schemaName: rows[0].schemaName,
    companyName: rows[0].companyName,
    email: rows[0].email,
    smppServerIp: rows[0].smppServerIp || null,
    smppServerPort: rows[0].smppServerPort || 2775,
  };
}

export async function getInvoiceSettings(schemaName: string): Promise<InvoiceSettings> {
  const defaults: InvoiceSettings = {
    id: 1,
    currency: "USD",
    timezone: "UTC",
    taxRate: 0,
    dueDays: 15,
    invoicePrefix: "",
    nextInvoiceNumber: 1000,
    defaultBankAccountId: null,
    autoEmailInvoice: false,
    notifyRateChange: true,
    notifyLowBalance: true,
    welcomeEmailAuto: true,
  };
  try {
    const r = await pool.query(`SELECT * FROM "${schemaName}".invoice_settings ORDER BY id LIMIT 1`);
    const row = r.rows[0];
    if (!row) return defaults;
    return {
      id: row.id,
      currency: row.currency || "USD",
      timezone: row.timezone || "UTC",
      taxRate: parseFloat(row.tax_rate || "0") || 0,
      dueDays: parseInt(row.due_days) || 15,
      invoicePrefix: row.invoice_prefix || "",
      nextInvoiceNumber: parseInt(row.next_invoice_number) || 1000,
      defaultBankAccountId: row.default_bank_account_id || null,
      autoEmailInvoice: row.auto_email_invoice === true,
      notifyRateChange: row.notify_rate_change !== false,
      notifyLowBalance: row.notify_low_balance !== false,
      welcomeEmailAuto: row.welcome_email_auto !== false,
    };
  } catch {
    return defaults;
  }
}

/** Atomically allocate the next sequential invoice number for a tenant. */
export async function allocateInvoiceNumber(schemaName: string, settings?: InvoiceSettings): Promise<string> {
  const s = settings || (await getInvoiceSettings(schemaName));
  try {
    const r = await pool.query(
      `UPDATE "${schemaName}".invoice_settings SET next_invoice_number = next_invoice_number + 1
       WHERE id = $1 RETURNING next_invoice_number`,
      [s.id]
    );
    const num = r.rows[0]?.next_invoice_number ?? s.nextInvoiceNumber + 1;
    return `${s.invoicePrefix}${num}`;
  } catch {
    return `${s.invoicePrefix}${Date.now()}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Invoice line-item builder (grouped by network → country → MCC)
// ─────────────────────────────────────────────────────────────────────────────

export async function buildLineItems(
  schemaName: string,
  kind: "client" | "supplier",
  entityId: number,
  periodStart: string,
  periodEnd: string
): Promise<{ items: LineItem[]; totalSms: number; totalCharge: number }> {
  const costCol = kind === "client" ? "m.cost" : "COALESCE(m.supplier_cost, '0')";
  const idCol = kind === "client" ? "m.client_id" : "m.supplier_id";
  const rateTable = kind === "client" ? "client_rates" : "supplier_rates";
  const rateCol = kind === "client" ? "rate" : "cost";
  const rateIdCol = kind === "client" ? "client_id" : "supplier_id";

  const r = await pool.query(
    `SELECT
       COALESCE(rp.name, 'Default Plan') AS network,
       COALESCE(MIN(mdb.country_name), 'Unknown') AS country,
       COALESCE(MIN(mdb.mcc), '') AS mcc,
       COUNT(*) AS total_sms,
       SUM(COALESCE(CAST(${costCol} AS DECIMAL), 0)) AS total_charge,
       SUBSTRING(m.destination, 1, 3) AS prefix
     FROM "${schemaName}".messages m
     LEFT JOIN "${schemaName}".route_plans rp ON rp.id = m.route_plan_id
     LEFT JOIN public.mcc_mnc_database mdb ON mdb.country_code = '+' || SUBSTRING(m.destination, 1, 3)
     WHERE ${idCol} = $1 AND m.created_at >= $2 AND m.created_at <= $3
     GROUP BY COALESCE(rp.name, 'Default Plan'), SUBSTRING(m.destination, 1, 3)
     ORDER BY COALESCE(rp.name, 'Default Plan'), total_sms DESC`,
    [entityId, periodStart, periodEnd]
  );

  const items: LineItem[] = [];
  let totalSms = 0;
  let totalCharge = 0;

  // Fetch the configured rates so the "Rate" column reflects the plan price,
  // falling back to the average effective charge when no explicit rate exists.
  let rates: { mcc: string; country_code: string; rate: number }[] = [];
  try {
    const rr = await pool.query(
      `SELECT DISTINCT ON (mcc, country_code) mcc, country_code, ${rateCol} AS rate
       FROM "${schemaName}".${rateTable}
       WHERE ${rateIdCol} = $1 AND is_active = true
       ORDER BY mcc, country_code, id DESC`,
      [entityId]
    );
    rates = (rr.rows || []).map((x: any) => ({
      mcc: x.mcc || "",
      country_code: x.country_code || "",
      rate: parseFloat(x.rate || "0") || 0,
    }));
  } catch {
    /* rate table missing on old schemas */
  }

  for (const row of r.rows) {
    const sms = parseInt(row.total_sms) || 0;
    const charge = parseFloat(row.total_charge || "0") || 0;
    const mcc = (row.mcc || "").toString();
    const country = (row.country || "Unknown").toString();
    const prefix = (row.prefix || "").toString();
    const matched = rates.find(
      (rt) => (rt.mcc && rt.mcc === mcc) || (rt.country_code && rt.country_code.replace("+", "") === prefix)
    );
    const rate = matched ? matched.rate : sms > 0 ? charge / sms : 0;
    items.push({
      network: (row.network || "Default Plan").toString(),
      country,
      mcc,
      totalSms: sms,
      rate: round6(rate),
      totalCharge: round6(charge),
      remarks: "",
    });
    totalSms += sms;
    totalCharge += charge;
  }

  return { items, totalSms, totalCharge: round6(totalCharge) };
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

// ─────────────────────────────────────────────────────────────────────────────
// Email senders
// ─────────────────────────────────────────────────────────────────────────────

export async function sendInvoiceEmail(
  schemaName: string,
  to: string,
  subject: string,
  html: string,
  attachments?: { filename: string; content: Buffer | string; contentType?: string }[]
): Promise<boolean> {
  return sendTenantEmail(schemaName, { to, subject, html, ...(attachments ? { attachments } : {}) });
}

export async function sendRateChangeEmail(
  schemaName: string,
  opts: { to: string; entityName: string; kind: "client" | "supplier"; country: string; oldRate: string; newRate: string }
): Promise<boolean> {
  const label = opts.kind === "client" ? "Client" : "Supplier";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a73e8;">Rate ${opts.oldRate ? "Updated" : "Added"}</h2>
      <p>The rate for <strong>${opts.entityName}</strong> (${label}) has been ${opts.oldRate ? "updated" : "added"}:</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Country:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${opts.country}</td></tr>
        ${opts.oldRate ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Old rate:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${opts.oldRate}</td></tr>` : ""}
        <tr><td style="padding: 8px;"><strong>New rate:</strong></td><td style="padding: 8px; font-weight: 600; color: #0d904f;">${opts.newRate}</td></tr>
      </table>
    </div>`;
  return sendTenantEmail(schemaName, { to: opts.to, subject: `Rate ${opts.oldRate ? "updated" : "added"} for ${opts.entityName} — ${opts.country}`, html });
}

export async function sendLowBalanceEmail(
  schemaName: string,
  opts: { to: string; clientName: string; balance: string; threshold: string; currency: string }
): Promise<boolean> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d93025;">⚠️ Low Balance Alert</h2>
      <p>The balance for client <strong>${opts.clientName}</strong> has reached <strong>${opts.balance} ${opts.currency}</strong>, at or below the alert threshold of ${opts.threshold} ${opts.currency}.</p>
      <p>Please top up to avoid service interruption.</p>
    </div>`;
  return sendTenantEmail(schemaName, { to: opts.to, subject: `Low balance: ${opts.clientName} (${opts.balance} ${opts.currency})`, html });
}

export async function sendClientWelcomeEmail(
  tenant: TenantInfo,
  client: { name: string; email: string; smpp_username?: string | null; smpp_password?: string | null; smpp_port?: number | null }
): Promise<boolean> {
  const ip = tenant.smppServerIp || process.env.SMPP_SERVER_IP || "";
  const port = client.smpp_port || tenant.smppServerPort || 2775;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); padding: 30px; border-radius: 12px 12px 0 0; color: white; text-align: center;">
        <h1 style="margin: 0;">Welcome to ${tenant.companyName}</h1>
        <p style="margin: 8px 0 0 0; opacity: .85;">Your SMPP account is ready</p>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <p>Dear <strong>${client.name}</strong>,</p>
        <p>Your SMPP connection details are below:</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; background: #f9fafb;"><strong>System ID (Username):</strong></td><td style="padding: 8px; font-family: monospace;">${client.smpp_username || "—"}</td></tr>
          <tr><td style="padding: 8px;"><strong>Password:</strong></td><td style="padding: 8px; font-family: monospace;">${client.smpp_password || "—"}</td></tr>
          <tr><td style="padding: 8px; background: #f9fafb;"><strong>Server IP:</strong></td><td style="padding: 8px; font-family: monospace;">${ip}</td></tr>
          <tr><td style="padding: 8px;"><strong>Port:</strong></td><td style="padding: 8px; font-family: monospace;">${port}</td></tr>
        </table>
      </div>
    </div>`;
  return sendTenantEmail(tenant.schemaName, {
    to: client.email,
    subject: `Welcome to ${tenant.companyName} — Your SMPP Details`,
    html,
  });
}

export async function sendSupplierWelcomeEmail(
  tenant: TenantInfo,
  supplier: { name: string; email: string; host?: string | null; port?: number | null; username?: string | null; system_id?: string | null }
): Promise<boolean> {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); padding: 30px; border-radius: 12px 12px 0 0; color: white; text-align: center;">
        <h1 style="margin: 0;">Supplier Onboarded</h1>
        <p style="margin: 8px 0 0 0; opacity: .85;">${tenant.companyName}</p>
      </div>
      <div style="border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; padding: 24px;">
        <p>Dear <strong>${supplier.name}</strong>,</p>
        <p>You have been added as a supplier. Connection details:</p>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px; background: #f9fafb;"><strong>System ID:</strong></td><td style="padding: 8px; font-family: monospace;">${supplier.system_id || supplier.username || "—"}</td></tr>
          <tr><td style="padding: 8px;"><strong>Host:</strong></td><td style="padding: 8px; font-family: monospace;">${supplier.host || tenant.smppServerIp || "—"}</td></tr>
          <tr><td style="padding: 8px; background: #f9fafb;"><strong>Port:</strong></td><td style="padding: 8px; font-family: monospace;">${supplier.port || tenant.smppServerPort || 2775}</td></tr>
        </table>
      </div>
    </div>`;
  return sendTenantEmail(tenant.schemaName, {
    to: supplier.email,
    subject: `Supplier access to ${tenant.companyName}`,
    html,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Invoice rendering (HTML / Excel / PDF) — matches the sample invoice layout
// ─────────────────────────────────────────────────────────────────────────────

export interface InvoiceRenderData {
  invoiceNumber: string;
  companyName: string;      // biller
  entityName: string;       // invoice "to" (client/supplier)
  entityCompany: string;
  entityEmail: string;
  entityPhone: string;
  entityAddress: string;
  entityCountry: string;
  currency: string;
  timezone: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  items: LineItem[];
  totalSms: number;
  totalCharge: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  bankAccounts: any[];
}

function fmtDate(d: string): string {
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildInvoiceHtml(d: InvoiceRenderData): string {
  const itemsHtml = d.items
    .map(
      (it) => `<tr>
        <td style="padding:6px 8px;border:1px solid #ddd;">${esc(it.network)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;">${esc(it.country)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;">${esc(it.mcc)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">${it.totalSms}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">${it.rate.toFixed(6)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">${it.totalCharge.toFixed(6)}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;">${esc(it.remarks)}</td>
      </tr>`
    )
    .join("");

  const bankHtml = d.bankAccounts
    .map(
      (b) => `<div style="margin-bottom:10px;font-size:12px;">
        <strong>${esc(b.account_holder_name || b.bank_name || "")}</strong><br/>
        ${esc(b.bank_name || "")}${b.account_number ? ` · A/C ${esc(b.account_number)}` : ""}<br/>
        ${b.iban ? `IBAN: ${esc(b.iban)}` : ""}${b.swift_bic ? ` · SWIFT: ${esc(b.swift_bic)}` : ""}<br/>
        ${esc(b.bank_address || "")}
        ${b.usdt_wallet ? `<br/>USDT (${esc(b.usdt_network || "TRC20")}): ${esc(b.usdt_wallet)}` : ""}
      </div>`
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(d.invoiceNumber)}</title></head>
  <body style="font-family:Arial,Helvetica,sans-serif;color:#222;max-width:760px;margin:0 auto;padding:24px;">
    <h1 style="margin:0;">INVOICE</h1>
    <p style="margin:2px 0 16px 0;color:#555;">Invoice number: <strong>${esc(d.invoiceNumber)}</strong></p>
    <table style="width:100%;font-size:13px;margin-bottom:16px;">
      <tr>
        <td style="vertical-align:top;width:50%;">
          <strong>${esc(d.companyName)}</strong>
        </td>
        <td style="vertical-align:top;width:50%;">
          <strong>Invoice to:</strong><br/>
          ${esc(d.entityCompany || d.entityName)}<br/>
          ${esc(d.entityAddress)}<br/>
          ${esc(d.entityEmail)}
        </td>
      </tr>
    </table>
    <table style="width:100%;font-size:12px;margin-bottom:16px;color:#333;">
      <tr>
        <td><strong>Currency:</strong> ${esc(d.currency)}</td>
        <td><strong>Timezone:</strong> ${esc(d.timezone)}</td>
        <td><strong>Issue date:</strong> ${fmtDate(d.issueDate)}</td>
        <td><strong>Due date:</strong> ${fmtDate(d.dueDate)}</td>
      </tr>
      <tr>
        <td colspan="2"><strong>Period start:</strong> ${fmtDate(d.periodStart)}</td>
        <td colspan="2"><strong>Period end:</strong> ${fmtDate(d.periodEnd)}</td>
      </tr>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Network</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Country</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">MCC</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:right;">Total SMS</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:right;">Rate</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:right;">Total charge</th>
        <th style="padding:6px 8px;border:1px solid #ddd;text-align:left;">Remarks</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <table style="width:50%;float:right;font-size:13px;border-collapse:collapse;">
      <tr><td style="padding:6px;"><strong>Total SMS</strong></td><td style="padding:6px;text-align:right;">${d.totalSms}</td></tr>
      <tr><td style="padding:6px;"><strong>Total charge</strong></td><td style="padding:6px;text-align:right;">${d.totalCharge.toFixed(6)}</td></tr>
      <tr><td style="padding:6px;"><strong>TAX (${d.taxRate}%)</strong></td><td style="padding:6px;text-align:right;">${d.taxAmount.toFixed(6)}</td></tr>
      <tr><td style="padding:6px;font-size:15px;"><strong>TOTAL WITH TAX</strong></td><td style="padding:6px;text-align:right;font-size:15px;font-weight:700;">${d.grandTotal.toFixed(6)}</td></tr>
    </table>
    <div style="clear:both;"></div>
    <div style="margin-top:24px;border-top:1px solid #ddd;padding-top:12px;">
      <h3 style="margin:0 0 8px 0;font-size:14px;">Payment / Bank Details</h3>
      ${bankHtml || "<p style='color:#999;'>No bank details configured.</p>"}
    </div>
    <script>window.addEventListener('load',function(){setTimeout(function(){window.print();},300);});</script>
  </body></html>`;
}

/** Build an .xlsx matching the sample invoice columns. */
export function buildInvoiceXlsx(d: InvoiceRenderData): Buffer {
  const rows: (string | number)[][] = [];
  rows.push(["Invoice number:", d.invoiceNumber, "", d.companyName]);
  rows.push(["Invoice to", "", "", d.entityAddress]);
  rows.push([d.entityCompany || d.entityName, "", "", d.entityEmail]);
  rows.push(["", "", "", `Currency: ${d.currency}`]);
  rows.push(["", "", "", `Timezone: ${d.timezone}`]);
  rows.push([`Billing period start: ${d.periodStart}`, "", "", `Invoice issue date: ${d.issueDate}`]);
  rows.push([`Billing period end: ${d.periodEnd}`, "", "", `Payment due date: ${d.dueDate}`]);
  rows.push([]);
  rows.push(["Network", "Country", "MCC", "Total SMS", "Rate", "Total charge per network", "Remarks"]);
  for (const it of d.items) {
    rows.push([it.network, it.country, it.mcc, it.totalSms, it.rate, it.totalCharge, it.remarks]);
  }
  rows.push([]);
  rows.push(["Invoice summary:"]);
  rows.push(["", "", "", "Total SMSes", "Total charge"]);
  rows.push(["", "", "Total", d.totalSms, d.totalCharge]);
  rows.push(["", "", `TAX (${d.taxRate}%):`, "", d.taxAmount]);
  rows.push(["", "", "TOTAL WITH TAX:", "", d.grandTotal]);
  rows.push([]);
  for (const b of d.bankAccounts) {
    rows.push([`Account Holder Name: ${b.account_holder_name || ""}`]);
    rows.push([`Bank Name: ${b.bank_name || ""}`]);
    rows.push([`Account Number: ${b.account_number || ""}`]);
    rows.push([`IBAN: ${b.iban || ""}`]);
    rows.push([`SWIFT / BIC: ${b.swift_bic || ""}`]);
    if (b.bank_address) rows.push([`Address: ${b.bank_address}`]);
    if (b.usdt_wallet) {
      rows.push([`USDT Wallet: ${b.usdt_wallet}`]);
      rows.push([`Network: ${b.usdt_network || "TRC20"}`]);
    }
    rows.push([]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 30 }, { wch: 18 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Invoice");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  return Buffer.from(buf);
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal, dependency-free PDF writer (A4, Helvetica, text/table layout)
// ─────────────────────────────────────────────────────────────────────────────

function pdfEscape(s: unknown): string {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) {
      if (cur) lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur.trim());
  if (lines.length === 0) lines.push("");
  return lines;
}

export function buildInvoicePdf(d: InvoiceRenderData): Buffer {
  const W = 595.28; // A4 width (pt)
  const H = 841.89; // A4 height (pt)
  const M = 40; // margin
  let content: string[] = [];
  let y = H - M;

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < M) {
      y = H - M;
    }
  };

  const text = (str: string, x: number, size: number, opts?: { bold?: boolean; color?: string; right?: boolean }) => {
    const font = opts?.bold ? "/F2" : "/F1";
    const color = opts?.color || "0 0 0";
    content.push(`BT ${font} ${size} Tf ${color} rg`);
    const escStr = pdfEscape(str);
    if (opts?.right) {
      // approximate right-alignment by measuring char width (Helvetica avg 0.5*size)
      const w = str.length * size * 0.5;
      content.push(`1 0 0 1 ${(x - w).toFixed(2)} ${y.toFixed(2)} Tm (${escStr}) Tj ET`);
    } else {
      content.push(`1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${escStr}) Tj ET`);
    }
  };

  const line = (x1: number, x2: number) => {
    content.push(`0.5 w 0 0 0 RG ${x1.toFixed(2)} ${y.toFixed(2)} m ${x2.toFixed(2)} ${y.toFixed(2)} l S`);
    y -= 2;
  };

  // ── Header ──
  text("INVOICE", M, 20, { bold: true });
  y -= 22;
  text(`Invoice number: ${d.invoiceNumber}`, M, 10);
  y -= 14;
  text(d.companyName, M, 10, { bold: true });
  y -= 26;

  // ── Invoice-to + meta ──
  text("Invoice to:", M, 10, { bold: true });
  y -= 13;
  const toLines = [
    d.entityCompany || d.entityName,
    d.entityAddress,
    d.entityEmail,
  ].filter(Boolean);
  for (const l of toLines) {
    for (const wl of wrapText(l, 60)) {
      text(wl, M, 9);
      y -= 11;
    }
  }
  y -= 6;
  const meta = [
    `Currency: ${d.currency}        Timezone: ${d.timezone}`,
    `Issue date: ${fmtDate(d.issueDate)}        Due date: ${fmtDate(d.dueDate)}`,
    `Period start: ${fmtDate(d.periodStart)}        Period end: ${fmtDate(d.periodEnd)}`,
  ];
  for (const l of meta) {
    text(l, M, 9);
    y -= 11;
  }
  y -= 8;

  // ── Table ──
  const cols = [
    { label: "Network", x: M, w: 90 },
    { label: "Country", x: M + 90, w: 80 },
    { label: "MCC", x: M + 170, w: 40 },
    { label: "SMS", x: M + 210, w: 45, right: true },
    { label: "Rate", x: M + 255, w: 70, right: true },
    { label: "Charge", x: M + 325, w: 75, right: true },
    { label: "Remarks", x: M + 400, w: W - M - (M + 400), right: false },
  ];
  const colRight = W - M;

  const drawRow = (cells: { text: string; bold?: boolean }[], height = 14) => {
    let maxLines = 1;
    const wrapped = cells.map((c, i) => {
      const col = cols[i];
      const maxChars = Math.max(6, Math.floor(col.w / 5));
      const lines = wrapText(c.text, maxChars);
      maxLines = Math.max(maxLines, lines.length);
      return lines;
    });
    const rowH = height * maxLines;
    newPageIfNeeded(rowH + 4);
    // background for header rows handled by caller via bold text; keep simple
    let startY = y;
    for (let i = 0; i < cells.length; i++) {
      const col = cols[i];
      const lines = wrapped[i];
      for (let li = 0; li < maxLines; li++) {
        const t = lines[Math.min(li, lines.length - 1)] || "";
        const ty = y - (li + 1) * height + 2;
        const font = cells[i].bold ? "/F2" : "/F1";
        const escStr = pdfEscape(t);
        const size = 8;
        if (col.right) {
          const w = t.length * size * 0.5;
          content.push(`BT ${font} ${size} Tf 0 0 0 rg 1 0 0 1 ${(col.x + col.w - w).toFixed(2)} ${ty.toFixed(2)} Tm (${escStr}) Tj ET`);
        } else {
          content.push(`BT ${font} ${size} Tf 0 0 0 rg 1 0 0 1 ${col.x.toFixed(2)} ${ty.toFixed(2)} Tm (${escStr}) Tj ET`);
        }
      }
    }
    y -= rowH;
    // row separator
    content.push(`0.3 w 0.8 0.8 0.8 RG ${M.toFixed(2)} ${y.toFixed(2)} m ${colRight.toFixed(2)} ${y.toFixed(2)} l S`);
  };

  drawRow(cols.map((c) => ({ text: c.label, bold: true })));
  for (const it of d.items) {
    drawRow([
      { text: it.network },
      { text: it.country },
      { text: it.mcc },
      { text: String(it.totalSms) },
      { text: it.rate.toFixed(6) },
      { text: it.totalCharge.toFixed(6) },
      { text: it.remarks },
    ]);
  }
  y -= 10;

  // ── Summary ──
  const summary = [
    `Total SMS: ${d.totalSms}`,
    `Total charge: ${d.totalCharge.toFixed(6)} ${d.currency}`,
    `TAX (${d.taxRate}%): ${d.taxAmount.toFixed(6)}`,
    `TOTAL WITH TAX: ${d.grandTotal.toFixed(6)} ${d.currency}`,
  ];
  newPageIfNeeded(60);
  for (const l of summary) {
    text(l, colRight, 10, { right: true, bold: l.startsWith("TOTAL") });
    y -= 14;
  }
  y -= 10;

  // ── Bank details ──
  text("Payment / Bank Details", M, 11, { bold: true });
  y -= 16;
  for (const b of d.bankAccounts) {
    const lines = [
      `Holder: ${b.account_holder_name || ""}`,
      `Bank: ${b.bank_name || ""}`,
      b.account_number ? `Account: ${b.account_number}` : "",
      b.iban ? `IBAN: ${b.iban}` : "",
      b.swift_bic ? `SWIFT: ${b.swift_bic}` : "",
      b.bank_address ? `Address: ${b.bank_address}` : "",
      b.usdt_wallet ? `USDT (${b.usdt_network || "TRC20"}): ${b.usdt_wallet}` : "",
    ].filter(Boolean);
    newPageIfNeeded(lines.length * 11 + 6);
    for (const l of lines) {
      for (const wl of wrapText(l, 90)) {
        text(wl, M, 9);
        y -= 11;
      }
    }
    y -= 4;
  }

  const stream = content.join("\n");
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    out += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate export (client-wise / supplier-wise) — Excel + PDF
// ─────────────────────────────────────────────────────────────────────────────

export interface RateRow {
  country: string;
  countryCode: string;
  mcc: string;
  mnc: string;
  operator: string;
  rate: number;
  currency: string;
}

export interface RateGroup {
  name: string;
  email: string;
  rows: RateRow[];
}

/** Load active rates grouped per client/supplier. */
export async function loadRateGroups(
  schemaName: string,
  kind: "client" | "supplier",
  entityId?: number
): Promise<RateGroup[]> {
  const table = kind === "client" ? "client_rates" : "supplier_rates";
  const entityTable = kind === "client" ? "clients" : "suppliers";
  const rateCol = kind === "client" ? "rate" : "cost";
  const idCol = kind === "client" ? "client_id" : "supplier_id";

  const r = await pool.query(
    `SELECT cr.${rateCol} AS rate, cr.country_code, cr.mcc, cr.mnc, cr.operator_name,
            e.name AS entity_name, COALESCE(e.billing_email, e.email) AS email, COALESCE(e.currency, 'USD') AS currency,
            COALESCE(mdb.country_name, cr.country_code) AS country
     FROM "${schemaName}".${table} cr
     JOIN "${schemaName}".${entityTable} e ON e.id = cr.${idCol}
     LEFT JOIN public.mcc_mnc_database mdb ON mdb.country_code = '+' || cr.country_code
     WHERE cr.is_active = true ${entityId ? `AND cr.${idCol} = $1` : ""}
     ORDER BY e.name, cr.country_code, cr.mcc, cr.mnc`,
    entityId ? [entityId] : []
  );

  const groups = new Map<string, RateGroup>();
  for (const row of r.rows) {
    const name = (row.entity_name || "Unknown").toString();
    if (!groups.has(name)) {
      groups.set(name, { name, email: (row.email || "").toString(), rows: [] });
    }
    groups.get(name)!.rows.push({
      country: (row.country || row.country_code || "Unknown").toString(),
      countryCode: (row.country_code || "").toString(),
      mcc: (row.mcc || "").toString(),
      mnc: (row.mnc || "").toString(),
      operator: (row.operator_name || "").toString(),
      rate: parseFloat(row.rate || "0") || 0,
      currency: (row.currency || "USD").toString(),
    });
  }
  return Array.from(groups.values());
}

export function buildRatesXlsx(groups: RateGroup[], title: string): Buffer {
  const wb = XLSX.utils.book_new();
  const header = ["Country", "Country Code", "MCC", "MNC", "Operator", "Rate", "Currency"];
  for (const g of groups) {
    const rows: (string | number)[][] = [[title], [g.name], [], header];
    for (const rw of g.rows) {
      rows.push([rw.country, rw.countryCode, rw.mcc, rw.mnc, rw.operator, rw.rate, rw.currency]);
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 22 }, { wch: 12 }, { wch: 10 }];
    // Sheet names max 31 chars, must be unique
    const safeName = (g.name || "Rates").replace(/[\[\]\*\?\/:\\]/g, "_").slice(0, 31) || "Rates";
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
  if (groups.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([[title], ["No rates found."]]);
    XLSX.utils.book_append_sheet(wb, ws, "Rates");
  }
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function buildRatesPdf(groups: RateGroup[], title: string): Buffer {
  const W = 595.28;
  const H = 841.89;
  const M = 40;
  let content: string[] = [];
  let y = H - M;

  const newPageIfNeeded = (needed: number) => {
    if (y - needed < M) y = H - M;
  };

  const text = (str: string, x: number, size: number, opts?: { bold?: boolean }) => {
    const font = opts?.bold ? "/F2" : "/F1";
    content.push(`BT ${font} ${size} Tf 0 0 0 rg 1 0 0 1 ${x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(str)}) Tj ET`);
  };

  text(title, M, 16, { bold: true });
  y -= 24;

  const cols = [
    { label: "Country", x: M, w: 110 },
    { label: "MCC", x: M + 110, w: 50 },
    { label: "MNC", x: M + 160, w: 50 },
    { label: "Operator", x: M + 210, w: 150 },
    { label: "Rate", x: M + 360, w: W - M - (M + 360), right: true },
  ];

  const drawHeader = () => {
    newPageIfNeeded(16);
    cols.forEach((c) => text(c.label, c.x, 8, { bold: true }));
    y -= 12;
  };

  for (const g of groups) {
    newPageIfNeeded(20);
    text(g.name, M, 11, { bold: true });
    y -= 14;
    drawHeader();
    for (const rw of g.rows) {
      newPageIfNeeded(12);
      const cells = [
        wrapText(rw.country, Math.max(6, Math.floor(cols[0].w / 5)))[0] || "",
        rw.mcc,
        rw.mnc,
        wrapText(rw.operator, Math.max(6, Math.floor(cols[3].w / 5)))[0] || "",
        `${rw.rate.toFixed(6)} ${rw.currency}`,
      ];
      cells.forEach((t, i) => {
        const col = cols[i];
        if (col.right) {
          const w = t.length * 8 * 0.5;
          content.push(`BT /F1 8 Tf 0 0 0 rg 1 0 0 1 ${(col.x + col.w - w).toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(t)}) Tj ET`);
        } else {
          content.push(`BT /F1 8 Tf 0 0 0 rg 1 0 0 1 ${col.x.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(t)}) Tj ET`);
        }
      });
      y -= 12;
    }
    y -= 8;
  }

  const stream = content.join("\n");
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

/** Email a client/supplier's rate card as PDF + Excel attachments. */
export async function forwardRatesEmail(
  schemaName: string,
  kind: "client" | "supplier",
  entityId: number,
  title: string
): Promise<{ ok: boolean; to?: string; reason?: "no_rates" | "no_email" | "send_failed" }> {
  const groups = await loadRateGroups(schemaName, kind, entityId);
  if (groups.length === 0) return { ok: false, reason: "no_rates" };
  const g = groups[0];
  if (!g.email) return { ok: false, reason: "no_email" };
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a73e8;">${title}</h2>
      <p>Please find your current rate card attached (PDF + Excel).</p>
    </div>`;
  const ok = await sendTenantEmail(schemaName, {
    to: g.email,
    subject: `${title} — ${g.name}`,
    html,
    attachments: [
      { filename: `${kind}_rates_${entityId}.xlsx`, content: buildRatesXlsx(groups, title), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      { filename: `${kind}_rates_${entityId}.pdf`, content: buildRatesPdf(groups, title), contentType: "application/pdf" },
    ],
  });
  return ok ? { ok, to: g.email } : { ok: false, to: g.email, reason: "send_failed" };
}

/**
 * Append one entry to the rate_history audit table.
 */
export async function logRateHistory(
  schemaName: string,
  entry: {
    rateType: "client" | "supplier";
    entityId: number;
    entityName: string;
    rateId: number | null;
    oldRateId?: number | null;
    countryCode?: string | null;
    country?: string | null;
    mcc?: string | null;
    mnc?: string | null;
    operatorName?: string | null;
    oldRate?: string | null;
    newRate: string;
    action?: string;
    batchCount?: number | null;
    rateIds?: string | null;
    changedBy?: string | null;
  }
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO "${schemaName}".rate_history
        (rate_type, entity_id, entity_name, rate_id, old_rate_id, country_code, country, mcc, mnc, operator_name, old_rate, new_rate, action, batch_count, rate_ids, changed_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        entry.rateType,
        entry.entityId,
        entry.entityName,
        entry.rateId ?? null,
        entry.oldRateId ?? null,
        entry.countryCode ?? null,
        entry.country ?? null,
        entry.mcc ?? null,
        entry.mnc ?? null,
        entry.operatorName ?? null,
        entry.oldRate != null && entry.oldRate !== "" ? parseFloat(entry.oldRate) : null,
        parseFloat(entry.newRate) || 0,
        entry.action || "UPDATE",
        entry.batchCount ?? null,
        entry.rateIds ?? null,
        entry.changedBy ?? null,
      ]
    );
  } catch (e) {
    console.error(`[billing] rate history log failed (${schemaName}):`, (e as Error).message);
  }
}

/**
 * Log a rate change to history AND notify the admin/entity (email + dashboard
 * alert). Logging always happens; notifications respect the tenant settings.
 */
export async function recordRateChange(
  schemaName: string,
  kind: "client" | "supplier",
  entityId: number,
  opts: {
    rateId: number | null;
    oldRateId?: number | null;
    countryCode?: string | null;
    country?: string | null;
    mcc?: string | null;
    mnc?: string | null;
    operatorName?: string | null;
    oldRate?: string | null;
    newRate: string;
    action?: "CREATE" | "UPDATE";
    changedBy?: string | null;
  }
): Promise<void> {
  try {
    const table = kind === "client" ? "clients" : "suppliers";
    const r = await pool.query(
      `SELECT name, COALESCE(billing_email, email) AS email FROM "${schemaName}".${table} WHERE id = $1`,
      [entityId]
    );
    const entity = r.rows[0];
    const entityName = entity?.name || "Unknown";

    await logRateHistory(schemaName, {
      rateType: kind,
      entityId,
      entityName,
      rateId: opts.rateId,
      oldRateId: opts.oldRateId,
      countryCode: opts.countryCode,
      country: opts.country,
      mcc: opts.mcc,
      mnc: opts.mnc,
      operatorName: opts.operatorName,
      oldRate: opts.oldRate,
      newRate: opts.newRate,
      action: opts.action || "UPDATE",
      changedBy: opts.changedBy,
    });

    const settings = await getInvoiceSettings(schemaName);
    if (!settings.notifyRateChange) return;

    const label = opts.country || opts.countryCode || "";
    await createDashboardAlert(
      schemaName,
      "rate_change",
      `Rate ${opts.oldRate ? "updated" : "added"} for ${entityName}`,
      `${kind === "client" ? "Client" : "Supplier"} ${entityName}: ${label} rate ${opts.oldRate ? `changed from ${opts.oldRate} to` : "set to"} ${opts.newRate}.`,
      "info"
    );

    if (entity?.email) {
      await sendRateChangeEmail(schemaName, {
        to: entity.email,
        entityName,
        kind,
        country: label,
        oldRate: opts.oldRate || "",
        newRate: opts.newRate,
      });
    }
  } catch (e) {
    console.error(`[billing] rate-change record failed (${schemaName}):`, (e as Error).message);
  }
}

/**
 * Log a bulk rate import as a SINGLE grouped history entry (instead of one row
 * per operator) and send ONE notification (dashboard alert + email).
 */
export async function recordBulkRateChange(
  schemaName: string,
  kind: "client" | "supplier",
  entityId: number,
  opts: {
    country?: string | null;
    rate: string;
    batchCount: number;
    rateIds: number[];
    changedBy?: string | null;
  }
): Promise<void> {
  try {
    const table = kind === "client" ? "clients" : "suppliers";
    const r = await pool.query(
      `SELECT name, COALESCE(billing_email, email) AS email FROM "${schemaName}".${table} WHERE id = $1`,
      [entityId]
    );
    const entity = r.rows[0];
    const entityName = entity?.name || "Unknown";
    const label = opts.country || "multiple countries";

    await logRateHistory(schemaName, {
      rateType: kind,
      entityId,
      entityName,
      rateId: null,
      country: label,
      newRate: opts.rate,
      action: "BULK_IMPORT",
      batchCount: opts.batchCount,
      rateIds: opts.rateIds.join(","),
      changedBy: opts.changedBy,
    });

    const settings = await getInvoiceSettings(schemaName);
    if (!settings.notifyRateChange) return;

    await createDashboardAlert(
      schemaName,
      "rate_change",
      `Bulk rate import for ${entityName}`,
      `${kind === "client" ? "Client" : "Supplier"} ${entityName}: imported ${opts.batchCount} operator rate(s) for ${label} at ${opts.rate}.`,
      "info"
    );

    if (entity?.email) {
      await sendRateChangeEmail(schemaName, {
        to: entity.email,
        entityName,
        kind,
        country: `${label} (${opts.batchCount} operators)`,
        oldRate: "",
        newRate: opts.rate,
      });
    }
  } catch (e) {
    console.error(`[billing] bulk rate-change record failed (${schemaName}):`, (e as Error).message);
  }
}

/** List rate history, newest first, optionally filtered by type/entity. */
export async function getRateHistory(
  schemaName: string,
  kind?: "client" | "supplier",
  entityId?: number
): Promise<any[]> {
  let sql = `SELECT * FROM "${schemaName}".rate_history`;
  const conds: string[] = [];
  const params: unknown[] = [];
  if (kind) { params.push(kind); conds.push(`rate_type = $${params.length}`); }
  if (entityId) { params.push(entityId); conds.push(`entity_id = $${params.length}`); }
  if (conds.length) sql += ` WHERE ${conds.join(" AND ")}`;
  sql += " ORDER BY id DESC LIMIT 300";
  const r = await pool.query(sql, params);
  return r.rows;
}

/** Revert a rate history entry, restoring the previous rate. */
export async function revertRateHistory(
  schemaName: string,
  historyId: number,
  changedBy?: string
): Promise<{ ok: boolean; message: string }> {
  const r = await pool.query(`SELECT * FROM "${schemaName}".rate_history WHERE id = $1`, [historyId]);
  const entry = r.rows[0];
  if (!entry) return { ok: false, message: "History entry not found" };

  const table = entry.rate_type === "client" ? "client_rates" : "supplier_rates";
  const rateCol = entry.rate_type === "client" ? "rate" : "cost";

  try {
    if (entry.action === "BULK_IMPORT") {
      // A grouped bulk import: revert = deactivate every rate created by the batch.
      const ids = String(entry.rate_ids || "")
        .split(",")
        .map((s: string) => parseInt(s.trim(), 10))
        .filter((n: number) => Number.isFinite(n) && n > 0);
      if (ids.length === 0) return { ok: false, message: "No rate IDs recorded for this import" };
      await pool.query(
        `UPDATE "${schemaName}".${table} SET is_active = false, updated_at = NOW() WHERE id = ANY($1::int[])`,
        [ids]
      );
    } else if (entry.action === "CREATE") {
      // A newly-added rate: revert = deactivate it and reactivate the superseded one (if any).
      if (entry.rate_id) {
        await pool.query(`UPDATE "${schemaName}".${table} SET is_active = false WHERE id = $1`, [entry.rate_id]);
      }
      if (entry.old_rate_id) {
        await pool.query(`UPDATE "${schemaName}".${table} SET is_active = true WHERE id = $1`, [entry.old_rate_id]);
      }
    } else {
      // A rate value change: revert = restore the old value.
      if (entry.rate_id && entry.old_rate != null) {
        await pool.query(`UPDATE "${schemaName}".${table} SET ${rateCol} = $1, updated_at = NOW() WHERE id = $2`, [entry.old_rate, entry.rate_id]);
      }
    }

    await logRateHistory(schemaName, {
      rateType: entry.rate_type,
      entityId: entry.entity_id,
      entityName: entry.entity_name || "Unknown",
      rateId: entry.rate_id,
      oldRateId: entry.old_rate_id,
      countryCode: entry.country_code,
      country: entry.country,
      mcc: entry.mcc,
      mnc: entry.mnc,
      operatorName: entry.operator_name,
      oldRate: entry.new_rate,
      newRate: entry.old_rate ?? entry.new_rate,
      action: "REVERT",
      batchCount: entry.batch_count,
      rateIds: entry.rate_ids,
      changedBy: changedBy || "revert",
    });
    return { ok: true, message: "Rate reverted" };
  } catch (e) {
    console.error(`[billing] rate revert failed (${schemaName}):`, (e as Error).message);
    return { ok: false, message: "Revert failed" };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Recurring invoice generation + low-balance alert sweeps (scheduler)
// ─────────────────────────────────────────────────────────────────────────────

export async function generateInvoicesForTenant(
  tenantId: number,
  schemaName: string,
  opts: { frequency?: string; dayOfWeek?: number; dayOfMonth?: number; intervalDays?: number | null; scope?: string; entityId?: number | null; periodDays?: number; scheduleId?: number | null }
): Promise<number> {
  const settings = await getInvoiceSettings(schemaName);
  const now = new Date();
  const periodEnd = now;
  const periodStart = new Date(now.getTime() - (opts.periodDays || 7) * 24 * 60 * 60 * 1000);
  const dueDate = new Date(now.getTime() + settings.dueDays * 24 * 60 * 60 * 1000);

  const ids = await (async () => {
    if (opts.scope && opts.entityId) {
      return [{ id: opts.entityId, name: "", email: "", type: opts.scope }];
    }
    // Generate for all active clients and suppliers
    const cr = await pool.query(`SELECT id, name, COALESCE(billing_email, email) AS email FROM "${schemaName}".clients WHERE deleted_at IS NULL AND is_active = true`);
    const sr = await pool.query(`SELECT id, name, COALESCE(billing_email, email) AS email FROM "${schemaName}".suppliers WHERE deleted_at IS NULL AND is_active = true`);
    return [
      ...cr.rows.map((r: any) => ({ id: r.id, name: r.name, email: r.email, type: "client" })),
      ...sr.rows.map((r: any) => ({ id: r.id, name: r.name, email: r.email, type: "supplier" })),
    ];
  })();

  let created = 0;
  for (const ent of ids) {
    if (!ent.email) continue;
    const { items, totalSms, totalCharge } = await buildLineItems(
      schemaName,
      ent.type as "client" | "supplier",
      ent.id,
      periodStart.toISOString(),
      periodEnd.toISOString()
    );
    if (items.length === 0) continue; // nothing to bill

    const taxAmount = round6(totalCharge * (settings.taxRate / 100));
    const grandTotal = round6(totalCharge + taxAmount);
    const invoiceNumber = await allocateInvoiceNumber(schemaName, settings);

    const invRes = await pool.query(
      `INSERT INTO "${schemaName}".invoices
        (client_id, invoice_number, amount, tax, total_amount, status, period_start, period_end, due_date,
         created_by, created_for_type, created_for_id, created_for_name, currency, issue_date, schedule_id)
       VALUES ($1,$2,$3,$4,$5,'DRAFT',$6,$7,$8,$9,$10,$11,$12,$13,NOW(),$14) RETURNING *`,
      [
        ent.type === "client" ? ent.id : null,
        invoiceNumber,
        totalCharge,
        taxAmount,
        grandTotal,
        periodStart.toISOString(),
        periodEnd.toISOString(),
        dueDate.toISOString(),
        "auto-scheduler",
        ent.type,
        ent.id,
        ent.name,
        settings.currency,
        opts.scheduleId || null,
      ]
    );
    const invId = invRes.rows[0].id;
    for (const it of items) {
      await pool.query(
        `INSERT INTO "${schemaName}".invoice_items (invoice_id, network, country, mcc, total_sms, rate, total_charge, remarks)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [invId, it.network, it.country, it.mcc, it.totalSms, it.rate, it.totalCharge, it.remarks]
      );
    }
    await createDashboardAlert(
      schemaName,
      "invoice_generated",
      `Invoice ${invoiceNumber} generated`,
      `Recurring invoice ${invoiceNumber} created for ${ent.name} (${totalSms} SMS, ${grandTotal} ${settings.currency}).`,
      "info"
    );

    if (settings.autoEmailInvoice) {
      const data: InvoiceRenderData = await loadInvoiceRenderData(schemaName, invId);
      const html = buildInvoiceHtml(data);
      await sendInvoiceEmail(schemaName, ent.email, `Invoice ${invoiceNumber} — ${settings.currency} ${grandTotal}`, html, [
        { filename: `${invoiceNumber}.xlsx`, content: buildInvoiceXlsx(data), contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
        { filename: `${invoiceNumber}.pdf`, content: buildInvoicePdf(data), contentType: "application/pdf" },
      ]);
      await pool.query(`UPDATE "${schemaName}".invoices SET status='SENT', email_sent_at=NOW() WHERE id=$1`, [invId]);
    }
    created++;
  }
  return created;
}

export async function loadInvoiceRenderData(schemaName: string, invoiceId: number): Promise<InvoiceRenderData> {
  const invRes = await pool.query(
    `SELECT i.*, c.name AS entity_name, c.company_name AS entity_company, c.email AS entity_email,
            c.phone AS entity_phone, c.address AS entity_address, c.country AS entity_country,
            s.name AS s_name, s.company_name AS s_company, s.email AS s_email, s.phone AS s_phone
     FROM "${schemaName}".invoices i
     LEFT JOIN "${schemaName}".clients c ON c.id = i.client_id
     LEFT JOIN "${schemaName}".suppliers s ON s.id = i.created_for_id AND i.created_for_type = 'supplier'
     WHERE i.id = $1`,
    [invoiceId]
  );
  const inv = invRes.rows[0];
  if (!inv) throw new Error("Invoice not found");

  const isSupplier = inv.created_for_type === "supplier";
  const itemsRes = await pool.query(
    `SELECT * FROM "${schemaName}".invoice_items WHERE invoice_id = $1 ORDER BY id`,
    [invoiceId]
  );
  const items: LineItem[] = itemsRes.rows.map((r: any) => ({
    network: r.network,
    country: r.country,
    mcc: r.mcc || "",
    totalSms: parseInt(r.total_sms) || 0,
    rate: parseFloat(r.rate || "0") || 0,
    totalCharge: parseFloat(r.total_charge || "0") || 0,
    remarks: r.remarks || "",
  }));

  const bankRes = await pool.query(
    `SELECT * FROM "${schemaName}".bank_accounts WHERE is_active = true ORDER BY id`
  );
  const settings = await getInvoiceSettings(schemaName);

  const totalSms = items.reduce((a, b) => a + b.totalSms, 0);
  const totalCharge = parseFloat(inv.amount || "0") || items.reduce((a, b) => a + b.totalCharge, 0);
  const taxAmount = parseFloat(inv.tax || "0") || 0;
  const grandTotal = parseFloat(inv.total_amount || "0") || totalCharge + taxAmount;

  return {
    invoiceNumber: inv.invoice_number,
    companyName: (await getTenantCompanyName(schemaName)) || "Net2APP",
    entityName: isSupplier ? (inv.s_name || inv.created_for_name) : (inv.entity_name || inv.created_for_name),
    entityCompany: isSupplier ? (inv.s_company || "") : (inv.entity_company || ""),
    entityEmail: isSupplier ? (inv.s_email || "") : (inv.entity_email || ""),
    entityPhone: isSupplier ? (inv.s_phone || "") : (inv.entity_phone || ""),
    entityAddress: inv.entity_address || "",
    entityCountry: inv.entity_country || "",
    currency: inv.currency || settings.currency || "USD",
    timezone: settings.timezone,
    periodStart: inv.period_start,
    periodEnd: inv.period_end,
    issueDate: inv.issue_date || inv.created_at,
    dueDate: inv.due_date,
    items,
    totalSms,
    totalCharge,
    taxRate: settings.taxRate,
    taxAmount,
    grandTotal,
    bankAccounts: bankRes.rows,
  };
}

let companyNameCache = new Map<string, string>();
async function getTenantCompanyName(schemaName: string): Promise<string | null> {
  if (companyNameCache.has(schemaName)) return companyNameCache.get(schemaName)!;
  try {
    const r = await pool.query(`SELECT company_name FROM tenants WHERE schema_name = $1`, [schemaName]);
    companyNameCache.set(schemaName, r.rows[0]?.company_name || null);
    return r.rows[0]?.company_name || null;
  } catch {
    return null;
  }
}

/** Run due recurring schedules for a single tenant. */
async function runTenantSchedules(tenant: TenantInfo): Promise<number> {
  const now = new Date();
  const r = await pool.query(
    `SELECT * FROM "${tenant.schemaName}".invoice_schedules
     WHERE is_active = true AND (next_run_at IS NULL OR next_run_at <= NOW())
     ORDER BY id`
  );
  let generated = 0;
  for (const s of r.rows) {
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay(); // 1=Mon..7=Sun
    const due =
      s.frequency === "daily" ||
      (s.frequency === "weekly" && (s.day_of_week || 1) === dayOfWeek) ||
      (s.frequency === "monthly" && (s.day_of_month || 1) === now.getDate());
    if (!due) continue;

    try {
      generated += await generateInvoicesForTenant(tenant.id, tenant.schemaName, {
        frequency: s.frequency,
        dayOfWeek: s.day_of_week,
        dayOfMonth: s.day_of_month,
        intervalDays: s.interval_days,
        scope: s.scope,
        entityId: s.entity_id,
        periodDays: s.period_days || 7,
        scheduleId: s.id,
      });
      const next = nextRunDate(s.frequency, s.day_of_week, s.day_of_month, s.interval_days);
      await pool.query(`UPDATE "${tenant.schemaName}".invoice_schedules SET last_run_at = NOW(), next_run_at = $1 WHERE id = $2`, [next, s.id]);
    } catch (e) {
      console.error(`[billing] schedule ${s.id} failed for ${tenant.schemaName}:`, (e as Error).message);
    }
  }
  return generated;
}

function nextRunDate(frequency: string, dayOfWeek: number, dayOfMonth: number, intervalDays: number | null): Date {
  const d = new Date();
  if (frequency === "daily") {
    d.setDate(d.getDate() + (intervalDays || 1));
  } else if (frequency === "weekly") {
    d.setDate(d.getDate() + 7);
  } else if (frequency === "monthly") {
    d.setMonth(d.getMonth() + 1);
  } else {
    d.setDate(d.getDate() + (intervalDays || 7));
  }
  return d;
}

/** Sweep all active tenants and generate due recurring invoices. */
export async function runRecurringInvoicing(): Promise<{ generated: number; errors: number }> {
  let generated = 0;
  let errors = 0;
  try {
    const rows = await db.select({ id: tenants.id, schemaName: tenants.schemaName }).from(tenants).where(eq(tenants.isActive, true));
    for (const t of rows) {
      if (!t.schemaName) continue;
      try {
        const info = await getTenantInfo(t.id);
        if (info) generated += await runTenantSchedules(info);
      } catch (e) {
        errors++;
        console.error(`[billing] recurring invoicing failed for tenant ${t.id}:`, (e as Error).message);
      }
    }
  } catch (e) {
    errors++;
    console.error("[billing] recurring invoicing sweep failed:", (e as Error).message);
  }
  if (generated || errors) console.log(`[RecurringInvoicing] generated=${generated} errors=${errors}`);
  return { generated, errors };
}

/** Sweep clients whose balance <= low_balance_threshold and notify. */
export async function runLowBalanceAlerts(): Promise<{ notified: number; errors: number }> {
  let notified = 0;
  let errors = 0;
  try {
    const rows = await db.select({ id: tenants.id, schemaName: tenants.schemaName }).from(tenants).where(eq(tenants.isActive, true));
    for (const t of rows) {
      if (!t.schemaName) continue;
      try {
        const settings = await getInvoiceSettings(t.schemaName);
        if (!settings.notifyLowBalance) continue;
        const cr = await pool.query(
          `SELECT id, name, COALESCE(billing_email, email) AS email, balance, low_balance_threshold, currency
           FROM "${t.schemaName}".clients
           WHERE deleted_at IS NULL AND is_active = true
             AND COALESCE(billing_email, email) IS NOT NULL
             AND COALESCE(balance, 0) <= COALESCE(low_balance_threshold, 0)`,
          []
        );
        for (const c of cr.rows) {
          await sendLowBalanceEmail(t.schemaName, {
            to: c.email,
            clientName: c.name,
            balance: String(c.balance ?? "0"),
            threshold: String(c.low_balance_threshold ?? "0"),
            currency: c.currency || settings.currency,
          });
          await createDashboardAlert(
            t.schemaName,
            "low_balance",
            `Low balance: ${c.name}`,
            `Client ${c.name} balance is ${c.balance ?? 0} ${c.currency || settings.currency} (threshold ${c.low_balance_threshold ?? 0}).`,
            "warning"
          );
          notified++;
        }
      } catch (e) {
        errors++;
        console.error(`[billing] low-balance sweep failed for tenant ${t.id}:`, (e as Error).message);
      }
    }
  } catch (e) {
    errors++;
    console.error("[billing] low-balance sweep failed:", (e as Error).message);
  }
  if (notified || errors) console.log(`[LowBalanceAlerts] notified=${notified} errors=${errors}`);
  return { notified, errors };
}
