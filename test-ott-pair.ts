/**
 * Quick script to test OTT WhatsApp pairing end-to-end through the residential proxy.
 * Uses the pairing engine directly to avoid needing HTTP auth tokens.
 * 
 * Usage: npx tsx test-ott-pair.ts
 */
import { initiatePairing, startRealPairing, checkPairingStatus } from "./src/lib/ott-pairing-engine";

const SCHEMA = "tenant_elias_triangletrade_net_1782860935293";
const DEVICE_ID = 1;

async function main() {
  console.log("=== OTT Pairing Test ===");
  console.log(`Schema: ${SCHEMA}, Device: ${DEVICE_ID}`);
  console.log("Proxy: 100.127.45.126:1080 (socks5 via Tailscale)\n");

  // Step 1: Initiate pairing
  console.log("Step 1: Initiating pairing...");
  const result = await initiatePairing(SCHEMA, DEVICE_ID);
  
  if ("error" in result) {
    console.error(`❌ Initiation failed: ${result.error} (status ${result.status})`);
    process.exit(1);
  }
  
  console.log(`✅ Pairing initiated`);
  console.log(`   Session: ${result.session}`);
  console.log(`   Expires: ${result.expiresAt}`);
  console.log(`   Type: ${result.deviceType}\n`);

  // Step 2: Start real pairing (fire and forget, but we'll poll for QR)
  console.log("Step 2: Starting real WhatsApp connection through proxy...");
  console.log("   Connecting to WhatsApp via SOCKS5 proxy → Tailscale → Residential IP...\n");

  // Fire and forget - the pairing engine handles the connection lifecycle
  startRealPairing(SCHEMA, DEVICE_ID).catch((err) => {
    console.error("Background pairing error:", err);
  });

  // Step 3: Poll for QR code for up to 30 seconds
  console.log("Step 3: Polling for QR code (up to 45 seconds)...");
  let qrReady = false;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    
    const status = await checkPairingStatus(SCHEMA, DEVICE_ID);
    
    if ("error" in status) {
      console.error(`❌ Status check error: ${status.error}`);
      continue;
    }
    
    const emoji = status.status === "AWAITING_SCAN" ? "📱" 
      : status.status === "ONLINE" ? "✅" 
      : status.status === "FAILED" ? "❌"
      : status.status === "PENDING_QR" ? "⏳"
      : "⏺️";
    
    console.log(`   [${i * 3 + 3}s] ${emoji} Status: ${status.status} - ${status.message}`);
    
    if (status.status === "AWAITING_SCAN" && status.qrCode) {
      qrReady = true;
      console.log(`\n✅✅✅ QR CODE GENERATED SUCCESSFULLY! ✅✅✅`);
      console.log(`   QR Code length: ${status.qrCode.length} chars (data URI)`);
      console.log(`   Expires: ${status.qrExpiresAt}`);
      console.log(`\n   The QR code is now stored in the database.`);
      console.log(`   Go to Dashboard → OTT Devices to scan it with WhatsApp.\n`);
      break;
    }
    
    if (status.status === "FAILED") {
      console.error(`\n❌ Pairing FAILED: ${status.message}`);
      break;
    }
    
    if (status.status === "ONLINE") {
      console.log(`\n✅✅✅ DEVICE IS ONLINE! ✅✅✅`);
      console.log(`   WhatsApp is connected through the residential proxy.\n`);
      break;
    }
  }

  if (!qrReady) {
    console.log("\n⚠️ QR code not received in 45 seconds.");
    console.log("Check: Is the SOCKS5 proxy accessible? Is baileys able to connect to WhatsApp through it?");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
