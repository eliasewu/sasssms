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
// A SERVER-mode gateway that re-bound within this window is still "active"
// even if its in-memory session is momentarily absent (modems/gateways re-bind
// on a short cycle). Prevents the 30s sync from flapping BOUND -> UNBOUND.
const SERVER_RECENT_BIND_MS = 60_000;
import { pool } from "@/db";
import { isClientSessionActive, isSupplierServerSessionActive } from "@/lib/smpp-server";
import { isSupplierConnected } from "@/lib/smpp-client";
import { isRestGatewayOnline } from "@/lib/gateway-rest-registry";

export async function syncAllBindStatus() {
  // Read __serverStartTime at call time (NOT at module load time) because
  // ESM module body of sync-bind-status.ts executes BEFORE instrumentation.ts
  // sets __serverStartTime on globalThis.
  const serverStartTime = (globalThis as typeof globalThis & { __serverStartTime?: number }).__serverStartTime;
  const startupAge = serverStartTime ? Date.now() - serverStartTime : Infinity;
  const inGracePeriod = startupAge < SERVER_MODE_GRACE_PERIOD_MS;
  // Log only during the startup grace period — this sync runs every 30s on
  // every server, and the unconditional line previously flooded pm2 logs
  // (~5.7k lines/day/server). Per-change lines below still log real fixes.
  if (inGracePeriod) {
    console.log(`Syncing bind_status across all active tenants (grace period: ${Math.round(startupAge / 1000)}s since startup, skipping SERVER-mode suppliers)\n`);
  }

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

        // ── Non-SMPP Suppliers: set to ACTIVE ──
        await client.query(
          "UPDATE suppliers SET bind_status = 'ACTIVE', updated_at = NOW() WHERE connection_type != 'SMPP' AND is_active = true AND bind_status NOT IN ('ACTIVE', 'BOUND')"
        );

        // ── SMPP Suppliers ──
        const { rows: suppliers } = await client.query(
          "SELECT id, name, supplier_code, connection_mode, bind_status, last_bind_time FROM suppliers WHERE (connection_type = 'SMPP' OR (connection_type = 'ANDROID_SMS' AND connection_mode = 'SERVER')) AND is_active = true"
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
            // Connected via SMPP server-session OR HTTP REST registration,
            // OR re-bound recently (a gateway on a short re-bind cycle is
            // still active even when its in-memory session is momentarily
            // absent).
            const recentlyBound =
              !!s.last_bind_time &&
              (Date.now() - new Date(s.last_bind_time).getTime()) < SERVER_RECENT_BIND_MS;
            hasSession =
              isSupplierServerSessionActive(t.id, s.id) ||
              isRestGatewayOnline(t.id, s.id) ||
              recentlyBound;
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

    // Only log when something actually changed (the sync runs every 30s).
    if (totalFixed > 0) {
      console.log(`\nBind-status sync: fixed ${totalFixed} stale entries across ${tenants.length} tenants.`);
    }
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
