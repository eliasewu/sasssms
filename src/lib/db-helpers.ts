import { pool } from "@/db";

// Soft-delete: moves record to CDR, marks as deleted in DB
export async function softDelete(
  schemaName: string,
  table: string,
  id: number,
  deletedBy: string,
  tenantId?: number
) {
  const client = await pool.connect();
  try {
    // Fetch entity data before deleting
    await client.query(`SET search_path TO "${schemaName}"`);
    const { rows } = await client.query(
      `SELECT * FROM ${table} WHERE id = $1`, [id]
    );
    await client.query(`SET search_path TO public`);

    if (rows.length === 0) return false;

    const entity = rows[0];
    
    // Save to CDR
    try {
      await client.query(
        `INSERT INTO cdr_deleted_items (entity_type, entity_id, entity_name, entity_data, deleted_by, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [table, id, entity.name || entity.client_code || "Unknown", JSON.stringify(entity), deletedBy, tenantId || null]
      );
    } catch { /* table may not exist yet */ }

    // Soft delete (mark as deleted)
    await client.query(`SET search_path TO "${schemaName}"`);
    await client.query(
      `UPDATE ${table} SET is_active = false, deleted_at = NOW(), deleted_by = $1 WHERE id = $2`,
      [deletedBy, id]
    );
    await client.query(`SET search_path TO public`);

    // Audit log
    try {
      await client.query(
        `INSERT INTO audit_log (entity_type, entity_id, action, changed_by, old_data, tenant_id)
         VALUES ($1, $2, 'DELETE', $3, $4, $5)`,
        [table, id, deletedBy, JSON.stringify(entity), tenantId || null]
      );
    } catch { /* table may not exist yet */ }

    return true;
  } finally {
    client.release();
  }
}

// CRUD Audit log
export async function auditLog(
  entityType: string,
  entityId: number | null,
  action: string,
  changedBy: string,
  oldData?: Record<string, unknown>,
  newData?: Record<string, unknown>,
  tenantId?: number,
  ipAddress?: string
) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO audit_log (entity_type, entity_id, action, changed_by, old_data, new_data, ip_address, tenant_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [entityType, entityId, action, changedBy,
       oldData ? JSON.stringify(oldData) : null,
       newData ? JSON.stringify(newData) : null,
       ipAddress || null, tenantId || null]
    );
  } catch {
    // Table may not exist yet – fail silently
  } finally {
    client.release();
  }
}

// Login session tracking
export async function trackLogin(
  userType: string,
  userId: number,
  email: string,
  ipAddress: string,
  userAgent: string,
  tokenHash: string
) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO login_sessions (user_type, user_id, email, ip_address, user_agent, token_hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userType, userId, email, ipAddress, userAgent, tokenHash]
    );
  } catch {
    // Table may not exist yet – fail silently so login always succeeds
  } finally {
    client.release();
  }
}

// Track logout
export async function trackLogout(tokenHash: string) {
  const client = await pool.connect();
  try {
    await client.query(
      `UPDATE login_sessions SET logout_at = NOW() WHERE token_hash = $1 AND logout_at IS NULL`,
      [tokenHash]
    );
  } catch {
    // Table may not exist yet – fail silently
  } finally {
    client.release();
  }
}

// Get MCC traffic stats per client
export async function getMccTrafficStats(tenantId: number) {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT mcc, country_code, country_name, 
              SUM(message_count) as total_msgs,
              SUM(delivered_count) as delivered,
              SUM(failed_count) as failed,
              SUM(total_cost) as total_cost
       FROM mcc_traffic_stats 
       WHERE tenant_id = $1
       GROUP BY mcc, country_code, country_name
       ORDER BY total_msgs DESC`,
      [tenantId]
    );
    return rows;
  } catch {
    // Table may not exist yet – return empty
    return [];
  } finally {
    client.release();
  }
}
