/**
 * DLR Queue Persistence — DB-backed durability layer for the in-memory DLR queue.
 *
 * Wraps the pure in-memory dlr-queue.ts with PostgreSQL writes so queued DLRs
 * survive server restarts. On startup, loads any DLRs from the DB back into memory.
 *
 * Design:
 *  - In-memory queue is the primary store (fast, synchronous)
 *  - DB writes are fire-and-forget (async, best-effort)
 *  - DB reads happen once at startup to hydrate the in-memory queue
 *  - Cleanup removes entries from both memory and DB
 */
import { pool } from "@/db";
import * as memQueue from "@/lib/dlr-queue";
import type { DlrPayload } from "@/lib/smpp-client";

/**
 * Enqueue a DLR in memory AND persist to the database.
 * Fire-and-forget DB write — memory is the hot path, DB is for durability.
 */
export function enqueueDlrPersist(
  tenantId: number,
  clientId: number,
  schemaName: string,
  dlr: DlrPayload
): { depth: number; dropped: boolean } {
  // Write to in-memory queue (sync, fast path)
  const result = memQueue.enqueueDlr(tenantId, clientId, dlr);

  // Fire-and-forget DB write (best-effort durability)
  persistToDb(schemaName, clientId, dlr, result.dropped).catch((err) => {
    console.error(`[DLR-PERSIST] DB write failed for ${dlr.messageId}:`, err);
  });

  return result;
}

/**
 * Atomically dequeue all DLRs from memory AND delete them from the DB.
 */
export function dequeueAllDlrsPersist(
  tenantId: number,
  clientId: number,
  schemaName: string
): DlrPayload[] {
  const dlrs = memQueue.dequeueAllDlrs(tenantId, clientId);
  if (dlrs.length === 0) return [];

  // Fire-and-forget DB cleanup — delete only the dequeued message IDs
  const msgIds = dlrs.map((d) => d.messageId);
  deleteFromDb(schemaName, clientId, msgIds).catch((err) => {
    console.error(`[DLR-PERSIST] DB delete failed for client ${clientId}:`, err);
  });

  return dlrs;
}

/**
 * Re-queue DLRs that failed to send — persists them to DB as well.
 */
export function requeueDlrsPersist(
  tenantId: number,
  clientId: number,
  schemaName: string,
  dlrs: DlrPayload[]
): void {
  if (dlrs.length === 0) return;
  memQueue.requeueDlrs(tenantId, clientId, dlrs);

  // Persist each re-queued DLR to DB
  for (const dlr of dlrs) {
    persistToDb(schemaName, clientId, dlr, false).catch((err) => {
      console.error(`[DLR-PERSIST] Re-queue DB write failed for ${dlr.messageId}:`, err);
    });
  }
}

/**
 * Load all pending DLRs from the per-tenant DB into the in-memory queue.
 * Called at startup to hydrate the in-memory queue from the database.
 *
 * Must be called once per active tenant after the SMSC server starts.
 */
export async function loadDlrsFromDbForTenant(schemaName: string, tenantId: number): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);

    // Check if the pending_dlrs table exists (may not exist on older tenants)
    const { rows: tableCheck } = await client.query(
      `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'pending_dlrs')`,
      [schemaName]
    );
    if (!tableCheck[0]?.exists) {
      return 0;
    }

    const { rows } = await client.query(
      `SELECT client_id, message_id, supplier_message_id, status,
              submit_date, done_date, error_code, dest, src
       FROM pending_dlrs
       ORDER BY client_id, created_at ASC`
    );

    let loaded = 0;
    for (const row of rows) {
      const dlr: DlrPayload = {
        messageId: row.message_id,
        supplierMessageId: row.supplier_message_id || "",
        status: row.status,
        submitDate: row.submit_date || "",
        doneDate: row.done_date || "",
        errorCode: row.error_code || "000",
        dest: row.dest,
        src: row.src,
      };
      memQueue.enqueueDlr(tenantId, row.client_id, dlr);
      loaded++;
    }

    if (loaded > 0) {
      console.log(`[DLR-PERSIST] Loaded ${loaded} pending DLRs from ${schemaName} into memory`);
    }

    return loaded;
  } catch (err) {
    console.error(`[DLR-PERSIST] Failed to load DLRs for tenant ${schemaName}:`, err);
    return 0;
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

/**
 * Load pending DLRs from ALL active tenant schemas into memory.
 * Called once at startup after the SMSC server starts.
 */
export async function loadAllDlrsFromDb(): Promise<number> {
  const client = await pool.connect();
  try {
    const { rows: tenants } = await client.query(
      "SELECT id, schema_name FROM tenants WHERE is_active = true"
    );

    let total = 0;
    for (const t of tenants) {
      total += await loadDlrsFromDbForTenant(t.schema_name, t.id);
    }

    if (total > 0) {
      console.log(`[DLR-PERSIST] Total ${total} pending DLRs loaded from ${tenants.length} tenant(s)`);
    }

    return total;
  } finally {
    client.release();
  }
}

/**
 * Clean up stale DLRs from both the in-memory queue and the DB.
 * Called periodically by the cleanup interval.
 */
export async function cleanupStaleDlrsPersist(ttlMs?: number): Promise<number> {
  const memCleaned = memQueue.cleanupStaleDlrs(ttlMs);

  // Also clean DB
  const client = await pool.connect();
  try {
    const { rows: tenants } = await client.query(
      "SELECT id, schema_name FROM tenants WHERE is_active = true"
    );

    const cutoff = new Date(Date.now() - (ttlMs || memQueue.DLR_QUEUE_TTL_MS)).toISOString();
    let dbCleaned = 0;

    for (const t of tenants) {
      try {
        await client.query(`SET search_path TO "${t.schema_name}"`);
        // Check if table exists
        const { rows: tc } = await client.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'pending_dlrs')`,
          [t.schema_name]
        );
        if (!tc[0]?.exists) continue;

        const { rowCount } = await client.query(
          `DELETE FROM pending_dlrs WHERE created_at < $1`,
          [cutoff]
        );
        if (rowCount && rowCount > 0) dbCleaned += rowCount;
      } catch (err) {
        console.error(`[DLR-PERSIST] Cleanup failed for tenant ${t.schema_name}:`, err);
      }
    }

    if (memCleaned > 0 || dbCleaned > 0) {
      console.log(`[DLR-PERSIST] Cleanup: ${memCleaned} memory entries, ${dbCleaned} DB rows removed`);
    }

    return memCleaned + dbCleaned;
  } catch (err) {
    console.error(`[DLR-PERSIST] Cleanup error:`, err);
    return memCleaned;
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

// ── Internal helpers ──

async function persistToDb(
  schemaName: string,
  clientId: number,
  dlr: DlrPayload,
  dropOldest: boolean
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);

    await client.query(
      `INSERT INTO pending_dlrs (client_id, message_id, supplier_message_id, status, submit_date, done_date, error_code, dest, src)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [clientId, dlr.messageId, dlr.supplierMessageId, dlr.status, dlr.submitDate, dlr.doneDate, dlr.errorCode, dlr.dest, dlr.src]
    );

    if (dropOldest) {
      // Keep max 1000 per client in DB (match in-memory limit)
      await client.query(
        `DELETE FROM pending_dlrs WHERE client_id = $1 AND id NOT IN (
           SELECT id FROM pending_dlrs WHERE client_id = $1 ORDER BY created_at DESC LIMIT ${memQueue.MAX_DLR_QUEUE_PER_CLIENT}
         )`,
        [clientId]
      );
    }
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

async function deleteFromDb(schemaName: string, clientId: number, messageIds: string[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO "${schemaName}"`);
    await client.query(
      `DELETE FROM pending_dlrs WHERE client_id = $1 AND message_id = ANY($2::text[])`,
      [clientId, messageIds]
    );
  } finally {
    await client.query(`SET search_path TO public`);
    client.release();
  }
}

let persistCleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start periodic cleanup that removes stale DLRs from BOTH the in-memory queue
 * AND the database. A single interval runs cleanupStaleDlrsPersist which
 * handles both memory and DB in one pass.
 */
export function startDlrCleanupPersist(intervalMs: number = 120_000): ReturnType<typeof setInterval> {
  if (persistCleanupInterval) clearInterval(persistCleanupInterval);
  persistCleanupInterval = setInterval(() => {
    cleanupStaleDlrsPersist().catch((err) => {
      console.error("[DLR-PERSIST] Periodic cleanup failed:", err);
    });
  }, intervalMs);
  return persistCleanupInterval;
}

/**
 * Stop the periodic persist cleanup interval (for testing).
 */
export function stopDlrCleanupPersist(): void {
  if (persistCleanupInterval) {
    clearInterval(persistCleanupInterval);
    persistCleanupInterval = null;
  }
}
