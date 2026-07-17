/**
 * sync-bind-status.ts
 *
 * Syncs bind_status across ALL active tenants by cross-referencing the DB
 * with actual SMPP session state. Sets UNBOUND for any client/supplier that
 * has no active session but the DB says BOUND.
 *
 * IMPORTANT: During the first 2 minutes after server start (grace period),
 * SERVER-mode suppliers are SKIPPED. These are modems/gateways that connect
 * TO us — they need time to detect the dropped TCP connection and re-bind.
 * Preserving their DB BOUND status through the restart window prevents
 * false UNBOUND on the dashboard while the modem is still reconnecting.
 *
 * Run: npx tsx sync-bind-status.ts
 */

const SERVER_MODE_GRACE_PERIOD_MS = 120_000; // 2 minutes after server start
import { pool } from "@/db";
import { isClientSessionActive, isSupplierServerSessionActive } from "@/lib/smpp-server";
import { isSupplierConnected } from "@/lib/smpp-client";

export async function syncAllBindStatus() {
  // Read __serverStartTime at call time (NOT at module load time) because
  // ESM module body of sync-bind-status.ts executes BEFORE instrumentation.ts
  // sets __serverStartTime on globalThis.
  const serverStartTime = (globalThis as typeof globalThis & { __serverStartTime?: number }).__serverStartTime;
  const startupAge = serverStartTime ? Date.now() - serverStartTime : Infinity;
  const inGracePeriod = startupAge < SERVER_MODE_GRACE_PERIOD_MS;
  console.log(`Syncing bind_status across all active tenants...${inGracePeriod ? ` (grace period: ${Math.round(startupAge / 1000)}s since startup, skipping SERVER-mode suppliers)` : ""}\n`);

  const client = await pool.connect();
  try {
    const { rows: tenants } = await client.query(
      "SELECT id, schema_name FROM tenants WHERE is_active = true ORDER BY id"
    );

    let totalFixed = 0;

    for (const t of tenants) {
      try {
        await client.query(`SET search_path TO "${t.schema_name}"`);

        // ── Clients ──
        const { rows: clients } = await client.query(
          "SELECT id, name, smpp_username, bind_status FROM clients WHERE connection_type = 'SMPP' AND is_active = true"
        );

        for (const c of clients) {
          const hasSession = isClientSessionActive(c.id, t.schema_name);
          if (!hasSession && c.bind_status === "BOUND") {
            await client.query(
              "UPDATE clients SET bind_status = 'UNBOUND', updated_at = NOW() WHERE id = $1",
              [c.id]
            );
            console.log(`  ✅ ${t.schema_name} / client #${c.id} "${c.name}": BOUND → UNBOUND (no session)`);
            totalFixed++;
          } else if (hasSession && c.bind_status !== "BOUND") {
            await client.query(
              "UPDATE clients SET bind_status = 'BOUND', last_bind_time = NOW(), updated_at = NOW() WHERE id = $1",
              [c.id]
            );
            console.log(`  ✅ ${t.schema_name} / client #${c.id} "${c.name}": ${c.bind_status} → BOUND (session active)`);
            totalFixed++;
          }
        }

        // ── Suppliers ──
        const { rows: suppliers } = await client.query(
          "SELECT id, name, supplier_code, connection_mode, bind_status FROM suppliers WHERE connection_type = 'SMPP' AND is_active = true"
        );

        for (const s of suppliers) {
          // ── SERVER-mode suppliers (modems): skip during grace period after restart ──
          // These connect TO us — they need time to detect dropped TCP and re-bind.
          // Preserve their DB BOUND status so the dashboard doesn't show false UNBOUND.
          if (s.connection_mode === "SERVER" && inGracePeriod) {
            continue;
          }

          let hasSession: boolean;
          if (s.connection_mode === "SERVER") {
            hasSession = isSupplierServerSessionActive(t.id, s.id);
          } else {
            hasSession = isSupplierConnected(t.id, s.id);
          }

          if (!hasSession && s.bind_status === "BOUND") {
            await client.query(
              "UPDATE suppliers SET bind_status = 'UNBOUND', updated_at = NOW() WHERE id = $1",
              [s.id]
            );
            const label = s.name || s.supplier_code || `#${s.id}`;
            console.log(`  ✅ ${t.schema_name} / supplier #${s.id} "${label}": BOUND → UNBOUND (no connection)`);
            totalFixed++;
          } else if (hasSession && s.bind_status !== "BOUND") {
            await client.query(
              "UPDATE suppliers SET bind_status = 'BOUND', last_bind_time = NOW(), updated_at = NOW() WHERE id = $1",
              [s.id]
            );
            const label = s.name || s.supplier_code || `#${s.id}`;
            console.log(`  ✅ ${t.schema_name} / supplier #${s.id} "${label}": ${s.bind_status} → BOUND (connected)`);
            totalFixed++;
          }
        }
      } catch (err) {
        console.warn(`  ⚠️ Skipping tenant ${t.schema_name}: ${(err as Error).message}`);
      }
    }

    await client.query("SET search_path TO public");

    console.log(`\nDone. Fixed ${totalFixed} stale bind_status entries across ${tenants.length} tenants.`);
  } finally {
    client.release();
  }
}

// Allow running directly: npx tsx sync-bind-status.ts
if (typeof require !== 'undefined' && require.main === module) {
  syncAllBindStatus().catch((err) => {
    console.error("Sync failed:", err);
    process.exit(1);
  });
}
