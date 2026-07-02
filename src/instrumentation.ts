/**
 * Net2APP Server Startup
 * Launches SMPP SMSC server on port 2775 alongside Next.js
 * Java 21 compatible SMPP v3.4 ESME/SMSC
 */
import { startSmppServer } from "@/lib/smpp-server";

let smppServer: ReturnType<typeof startSmppServer> | null = null;

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const port = parseInt(process.env.SMPP_PORT || "2775");

    console.log("=".repeat(50));
    console.log("  Net2APP SMS Gateway Platform");
    console.log("  Tri Angle Trade Centre Fze LLC");
    console.log("=".repeat(50));

    // Start SMPP SCSC server for ESME clients
    smppServer = startSmppServer(port);
    console.log(`  SMPP SMSC Server: 0.0.0.0:${port}`);
    console.log("  Protocol: SMPP v3.4 (ESME → SMSC)");
    console.log("  Java 21 compatible");

    // DLR push is now real-time via supplier DLR callbacks
    console.log("  DLR Push: Real-time (SMPP + HTTP callbacks)");
    console.log("  DLR Flow: Mobile → Supplier → SMSC → Route → Client (SMPP/HTTP)");
    console.log("=".repeat(50));
  }
}
