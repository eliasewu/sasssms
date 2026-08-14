/**
 * Net2APP Server Startup
 * Launches SMPP SMSC server on port 2775 alongside Next.js
 * Java 21 compatible SMPP v3.4 ESME/SMSC
 *
 * All Node.js-heavy imports are dynamic (import() inside the runtime check)
 * to prevent Turbopack from statically analyzing them for Edge Runtime.
 *
 * isMainThread guard ensures background services (SMPP, DLR, email, etc.)
 * only start once on the main process, not in every Next.js worker thread.
 * Without this, duplicated services exhaust file descriptors causing 502s.
 */

// Record server start time so syncAllBindStatus can give SERVER-mode modems
// (which connect TO us) a grace period to reconnect after restart.
const _global = globalThis as typeof globalThis & { __serverStartTime?: number };
_global.__serverStartTime = Date.now();

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { isMainThread } = await import("node:worker_threads");
    if (!isMainThread) return;

    // Emergency bypass: skip all background services (SMPP, DLR, etc.)
    if (process.env.SKIP_BACKGROUND_SERVICES === "true") {
      console.log("[instrumentation] SKIP_BACKGROUND_SERVICES=true — skipping all background services");
      return;
    }
    // ── Dynamic imports — all Node.js-only modules loaded lazily ──
    const [
      { startSmppServer },
      { initSupplierConnections, recoverPendingDeliveriesFromDb },
      { syncAllBindStatus },
      { startDlrPolling },
      { startDlrTimeoutSweeper },
      { startOtpForwarder },
      { checkPackageExpiry, autoRenewSubscriptions },
      { startSupplierUnbindAlerts },
      { startPm2HealthMonitor },
    ] = await Promise.all([
      import("@/lib/smpp-server"),
      import("@/lib/smpp-client"),
      import("../sync-bind-status"),
      import("@/lib/dlr-poller"),
      import("@/lib/dlr-timeout-sweeper"),
      import("@/lib/otp-forwarder"),
      import("@/lib/email-service"),
      import("@/lib/supplier-unbind-alert"),
      import("@/lib/pm2-health-monitor"),
    ]);

    const port = parseInt(process.env.SMPP_PORT || "2775");

    console.log("=".repeat(50));
    console.log("  Net2APP SMS Gateway Platform");
    console.log("  Tri Angle Trade Centre FZE LLC");
    console.log("=".repeat(50));

    // Start SMPP SCSC server for ESME clients
    const smppServer = startSmppServer(port);
    console.log(`  SMPP SMSC Server: 0.0.0.0:${port}`);
    console.log("  Protocol: SMPP v3.3 / v3.4 / v5.0 (auto-negotiated)");
    console.log("  Java 21 compatible");

    // Initialize outbound SMPP connections to CLIENT-mode suppliers
    initSupplierConnections().then(() => {
      console.log("  Outbound connections initialized");
    }).catch((err: Error) => {
      console.error("  Failed to initialize outbound connections:", err.message);
    });

    // Re-hydrate in-flight pending deliveries from the DB so DLRs that arrive
    // after a restart are still matched (no message/DLR loss on process restart).
    recoverPendingDeliveriesFromDb().catch((err: Error) => {
      console.error("  Pending delivery re-hydration failed:", err.message);
    });

    // Sync bind_status across ALL tenants every 30 seconds.
    // First sync runs after a 30s delay so CLIENT-mode suppliers have time
    // to auto-connect and SERVER-mode modems can re-bind after restart.
    const runBindSync = () => {
      syncAllBindStatus().catch((err: Error) => {
        console.error("  Bind status sync failed:", err.message);
      });
    };
    setTimeout(() => {
      runBindSync();
      setInterval(runBindSync, 30000); // every 30s
    }, 30000);

    // Start CUSTOM_API DLR polling worker (every 5s, per-connector cadence)
    startDlrPolling();
    console.log("  DLR Polling: Auto-polling CUSTOM_API DLR URLs every 5s (per-connector cadence)");

    // Start stale-DLR timeout sweeper (every 60s): resolves SENT/PENDING
    // messages across ALL flows after the dlr_timeout window (default 5 min).
    // on_dlr pending → FAILED/undelivered (no charge); force_dlr_timeout →
    // fake DELIVRD + charge client with ZERO supplier payout (matrix).
    startDlrTimeoutSweeper();
    console.log("  DLR Sweeper: Stale pending DLRs auto-resolved after 5 min (on_dlr → fail/undelivered, force_timeout → fake DELIVRD)");

    // Start OTP Forwarding worker (every 10s, extracts OTP from inbox, forwards to suppliers)
    startOtpForwarder();
    console.log("  OTP Forwarder: Auto-extracting OTP from inbox SMS every 10s");

    // DLR push is now real-time via supplier DLR callbacks
    console.log("  DLR Push: Real-time (SMPP + HTTP callbacks)");
    console.log("  DLR Flow: Mobile → Supplier → SMSC → Route → Client (SMPP/HTTP)");

    // ── Supplier Unbind SMS Alerts: notify tenant admin when a supplier goes UNBOUND ──
    startSupplierUnbindAlerts();
    console.log("  Unbind Alerts: SMS notification when supplier bind goes UNBOUND");

    // ── PM2 Health Monitor: cross-server PM2 watchdog with email alerts ──
    // Only the main Cloudflare origin server runs the monitor to avoid duplicate alerts
    if (process.env.PM2_MONITOR_MAIN === "true") {
      startPm2HealthMonitor();
      console.log("  PM2 Monitor: Cross-server PM2 health check every 60s — email alert if down");
    }

    // ── Package expiry checker: runs daily to notify Pro/Enterprise tenants at 14, 7, and 3 days before expiry ──
    console.log("  Package Expiry Checker: Daily reminders at 14d, 7d, and 3d before subscription expiry");
    // ── Auto-renewal: runs daily to auto-renew expired Pro/Enterprise subscriptions with sufficient balance ──
    console.log("  Auto-Renewal: Daily check for expired subscriptions with sufficient balance");
    // Run once at startup after a delay, then every 24 hours
    setTimeout(() => {
      checkPackageExpiry().catch((err: Error) => console.error("Package expiry check failed:", err.message));
      autoRenewSubscriptions().catch((err: Error) => console.error("Auto-renewal check failed:", err.message));
      setInterval(() => {
        checkPackageExpiry().catch((err: Error) => console.error("Package expiry check failed:", err.message));
        autoRenewSubscriptions().catch((err: Error) => console.error("Auto-renewal check failed:", err.message));
      }, 24 * 60 * 60 * 1000); // every 24 hours
    }, 30000); // 30s delay for DB connectivity

    console.log("=".repeat(50));
  }
}
