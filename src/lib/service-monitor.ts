/**
 * Service Health Monitor
 * Periodically checks tenant service health and creates alerts when services go offline.
 * Monitors: SMPP binds, supplier connectivity, OTT device status, tenant activity.
 */
import { db, pool } from "@/db";
import { tenants as tenantsTable, suppliers, alerts } from "@/db/schema";
import { eq, and, lt, desc, sql } from "drizzle-orm";

interface ServiceStatus {
  tenantId: number;
  tenantName: string;
  tenantEmail: string;
  services: {
    smppBinds: { total: number; bound: number; unbound: number };
    suppliers: { total: number; active: number; unbound: number };
    ottDevices: { total: number; online: number; offline: number };
    smsLastHour: number;
    isActive: boolean;
  };
}

/**
 * Create an alert in the public alerts table.
 * Deduplicates by checking for an existing unresolved alert of the same type in the last 10 minutes.
 */
async function createAlert(type: string, title: string, message: string, severity: "info" | "warning" | "error" = "warning") {
  try {
    // Check for duplicate in last 10 minutes
    const existing = await db
      .select({ id: alerts.id })
      .from(alerts)
      .where(and(eq(alerts.type, type), eq(alerts.isRead, false), sql`${alerts.createdAt} > NOW() - INTERVAL '10 minutes'`))
      .limit(1);

    if (existing.length > 0) return; // Already alerted

    await db.insert(alerts).values({
      type,
      title,
      message,
      severity,
      isRead: false,
    });
  } catch (err) {
    console.error("Failed to create alert:", err);
  }
}

/**
 * Check a single tenant's service health by querying their schema.
 */
async function checkTenantHealth(
  tenantId: number,
  tenantName: string,
  tenantEmail: string,
  schemaName: string,
  isActive: boolean
): Promise<ServiceStatus> {
  if (!isActive) {
    return {
      tenantId, tenantName, tenantEmail,
      services: { smppBinds: { total: 0, bound: 0, unbound: 0 }, suppliers: { total: 0, active: 0, unbound: 0 }, ottDevices: { total: 0, online: 0, offline: 0 }, smsLastHour: 0, isActive: false },
    };
  }

  // Validate schema name as defense-in-depth against injection
  if (!/^[a-z0-9_]+$/.test(schemaName)) {
    console.error(`Invalid schema name: ${schemaName}`);
    return {
      tenantId, tenantName, tenantEmail,
      services: { smppBinds: { total: 0, bound: 0, unbound: 0 }, suppliers: { total: 0, active: 0, unbound: 0 }, ottDevices: { total: 0, online: 0, offline: 0 }, smsLastHour: 0, isActive: false },
    };
  }

  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);

    // SMPP client binds
    const bindsResult = await client.query(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE bind_status = 'BOUND') as bound FROM clients WHERE is_active = true`
    );
    const smppBinds = {
      total: parseInt(bindsResult.rows[0]?.total || "0"),
      bound: parseInt(bindsResult.rows[0]?.bound || "0"),
      unbound: parseInt(bindsResult.rows[0]?.total || "0") - parseInt(bindsResult.rows[0]?.bound || "0"),
    };

    // Supplier status
    const suppResult = await client.query(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE bind_status = 'BOUND' AND is_active = true) as bound FROM suppliers`
    );
    const supplierStats = {
      total: parseInt(suppResult.rows[0]?.total || "0"),
      active: parseInt(suppResult.rows[0]?.bound || "0"),
      unbound: parseInt(suppResult.rows[0]?.total || "0") - parseInt(suppResult.rows[0]?.bound || "0"),
    };

    // OTT device status
    const ottResult = await client.query(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'ONLINE') as online FROM ott_devices WHERE is_active = true`
    );
    const ottStats = {
      total: parseInt(ottResult.rows[0]?.total || "0"),
      online: parseInt(ottResult.rows[0]?.online || "0"),
      offline: parseInt(ottResult.rows[0]?.total || "0") - parseInt(ottResult.rows[0]?.online || "0"),
    };

    // SMS traffic in last hour
    const smsResult = await client.query(
      `SELECT COUNT(*) as count FROM messages WHERE created_at > NOW() - INTERVAL '1 hour'`
    );
    const smsLastHour = parseInt(smsResult.rows[0]?.count || "0");

    return {
      tenantId, tenantName, tenantEmail,
      services: { smppBinds, suppliers: supplierStats, ottDevices: ottStats, smsLastHour, isActive },
    };
  } catch (err) {
    console.error(`Health check failed for tenant ${tenantName}:`, err);
    return {
      tenantId, tenantName, tenantEmail,
      services: { smppBinds: { total: 0, bound: 0, unbound: 0 }, suppliers: { total: 0, active: 0, unbound: 0 }, ottDevices: { total: 0, online: 0, offline: 0 }, smsLastHour: 0, isActive: false },
    };
  } finally {
    client.release();
  }
}

/** Cached results from the last health check. */
let lastStatuses: ServiceStatus[] = [];
let lastCheckTime: Date | null = null;

/**
 * Run a full health check on all tenants and create alerts for issues.
 * Results are cached and available via getLastStatuses().
 */
export async function runHealthCheck(): Promise<ServiceStatus[]> {
  const allTenants = await db
    .select({ id: tenantsTable.id, companyName: tenantsTable.companyName, email: tenantsTable.email, schemaName: tenantsTable.schemaName, isActive: tenantsTable.isActive })
    .from(tenantsTable);

  const statuses: ServiceStatus[] = [];

  for (const t of allTenants) {
    const status = await checkTenantHealth(t.id, t.companyName, t.email, t.schemaName, t.isActive);
    statuses.push(status);

    // Check for issues and create alerts
    if (!status.services.isActive) continue; // Skip inactive tenants

    // Alert: All SMPP clients unbound
    if (status.services.smppBinds.total > 0 && status.services.smppBinds.bound === 0) {
      await createAlert(
        "smpp_bind",
        `All SMPP clients unbound for ${t.companyName}`,
        `Tenant "${t.companyName}" has ${status.services.smppBinds.total} SMPP clients but none are bound. SMS delivery may be affected.`,
        "error"
      );
    }

    // Alert: All suppliers unbound
    if (status.services.suppliers.total > 0 && status.services.suppliers.active === 0) {
      await createAlert(
        "supplier",
        `All suppliers disconnected for ${t.companyName}`,
        `Tenant "${t.companyName}" has ${status.services.suppliers.total} suppliers but none are connected. Outbound SMS cannot be delivered.`,
        "error"
      );
    }

    // Alert: OTT devices all offline
    if (status.services.ottDevices.total > 0 && status.services.ottDevices.online === 0) {
      await createAlert(
        "ott_device",
        `All OTT devices offline for ${t.companyName}`,
        `Tenant "${t.companyName}" has ${status.services.ottDevices.total} OTT devices but all are offline. WhatsApp/Telegram messaging affected.`,
        "warning"
      );
    }

    // Alert: No SMS traffic in the last hour for active tenants with clients
    if (status.services.smppBinds.total > 0 && status.services.smsLastHour === 0) {
      await createAlert(
        "no_traffic",
        `No SMS traffic for ${t.companyName} in last hour`,
        `Tenant "${t.companyName}" has active SMPP clients but sent 0 messages in the last hour. Possible routing or connectivity issue.`,
        "info"
      );
    }
  }

  lastStatuses = statuses;
  lastCheckTime = new Date();
  return statuses;
}

/** Get the cached results from the last health check. */
export function getLastStatuses(): { statuses: ServiceStatus[]; lastCheckTime: Date | null } {
  return { statuses: lastStatuses, lastCheckTime };
}

/**
 * Get all alerts from the public alerts table.
 */
export async function getAlerts(limit: number = 100) {
  return db.select().from(alerts).orderBy(desc(alerts.id)).limit(limit);
}

/**
 * Mark an alert as read.
 */
export async function markAlertRead(alertId: number) {
  await db.update(alerts).set({ isRead: true }).where(eq(alerts.id, alertId));
}

/**
 * Mark all unread alerts as read.
 */
export async function markAllAlertsRead() {
  await db.update(alerts).set({ isRead: true }).where(eq(alerts.isRead, false));
}
export async function getUnreadAlertCount(): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(alerts)
    .where(eq(alerts.isRead, false));
  return result[0]?.count || 0;
}
