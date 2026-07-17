/**
 * Net2APP Server Startup
 * Launches SMPP SMSC server on port 2775 alongside Next.js
 * Java 21 compatible SMPP v3.4 ESME/SMSC
 */
import { startSmppServer } from "@/lib/smpp-server";
import { initSupplierConnections } from "@/lib/smpp-client";
import { syncAllBindStatus } from "../sync-bind-status";
import { startDlrPolling } from "@/lib/dlr-poller";
import { checkPackageExpiry } from "@/lib/email-service";

let smppServer: ReturnType<typeof startSmppServer> | null = null;

// Record server start time so syncAllBindStatus can give SERVER-mode modems
// (which connect TO us) a grace period to reconnect after restart.
const _global = globalThis as typeof globalThis & { __serverStartTime?: number };
_global.__serverStartTime = Date.now();

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const port = parseInt(process.env.SMPP_PORT || "2775");

    console.log("=".repeat(50));
    console.log("  Net2APP SMS Gateway Platform");
    console.log("  Tri Angle Trade Centre FZE LLC");
    console.log("=".repeat(50));

    // Start SMPP SCSC server for ESME clients
    smppServer = startSmppServer(port);
    console.log(`  SMPP SMSC Server: 0.0.0.0:${port}`);
    console.log("  Protocol: SMPP v3.3 / v3.4 / v5.0 (auto-negotiated)");
    console.log("  Java 21 compatible");

    // Initialize outbound SMPP connections to CLIENT-mode suppliers
    initSupplierConnections().then(() => {
      console.log("  Outbound connections initialized");
    }).catch((err: Error) => {
      console.error("  Failed to initialize outbound connections:", err.message);
    });

    // Sync bind_status across ALL tenants (existing + new) on startup.
    // Runs after a 30s delay so CLIENT-mode suppliers have time to auto-connect
    // and SERVER-mode modems have time to notice the dropped connection and re-bind.
    // NOTE: syncAllBindStatus skips SERVER-mode suppliers during the first 2 minutes
    // after startup to preserve their existing BOUND status in the DB.
    setTimeout(() => {
      syncAllBindStatus().catch((err: Error) => {
        console.error("  Bind status sync failed:", err.message);
      });
    }, 30000); // 30s delay (was 10s) gives modems time to reconnect after restart

    // Start CUSTOM_API DLR polling worker (every 30s)
    startDlrPolling();
    console.log("  DLR Polling: Auto-polling CUSTOM_API DLR URLs every 30s");

    // DLR push is now real-time via supplier DLR callbacks
    console.log("  DLR Push: Real-time (SMPP + HTTP callbacks)");
    console.log("  DLR Flow: Mobile → Supplier → SMSC → Route → Client (SMPP/HTTP)");

    // ── Package expiry checker: runs daily to notify Pro/Enterprise tenants 3 days before expiry ──
    console.log("  Package Expiry Checker: Daily notification for expiring subscriptions");
    // Run once at startup after a delay, then every 24 hours
    setTimeout(() => {
      checkPackageExpiry().catch((err: Error) => console.error("Package expiry check failed:", err.message));
      setInterval(() => {
        checkPackageExpiry().catch((err: Error) => console.error("Package expiry check failed:", err.message));
      }, 24 * 60 * 60 * 1000); // every 24 hours
    }, 30000); // 30s delay for DB connectivity

    console.log("=".repeat(50));
  }
}
