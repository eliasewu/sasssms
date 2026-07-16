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

    // Sync bind_status across ALL tenants (existing + new) on startup
    // Runs after a short delay so SMPP server has time to accept initial connections.
    // NOTE: The syncAllBindStatus script checks in-memory session maps (isSupplierServerSessionActive,
    // isClientSessionActive) which use globalThis-backed Maps populated by this same process.
    // The sync ONLY runs once at startup — it does NOT run periodically — to avoid the
    // module-isolation issue where API route entry points see empty Maps and incorrectly
    // mark sessions as UNBOUND.
    setTimeout(() => {
      syncAllBindStatus().catch((err: Error) => {
        console.error("  Bind status sync failed:", err.message);
      });
    }, 10000); // 10s delay gives modem time to reconnect after server restart

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
