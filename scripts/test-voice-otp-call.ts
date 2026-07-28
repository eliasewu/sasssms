#!/usr/bin/env npx tsx
/**
 * test-voice-otp-call.ts
 *
 * Configures and executes a real Voice OTP test call to Bangladesh.
 *
 * Parameters:
 *   - Destination:  8801615069178 (Bangladesh, +880 prefix, MCC 470)
 *   - Retry count:  2
 *   - Play count:   2 (each digit repeated 2 times)
 *   - SIP server:   198.27.80.229:5060
 *
 * Usage:
 *   npx tsx scripts/test-voice-otp-call.ts
 *
 * Prerequisites:
 *   - PostgreSQL running with DATABASE_URL set
 *   - At least 1 active tenant with routing infrastructure
 *   - Asterisk AMI reachable at 198.27.80.229:5038
 */

import { pool } from "@/db";
import { createToken } from "@/lib/auth";

// ═══════════════════════════════════════════════════════════════
//  Config
// ═══════════════════════════════════════════════════════════════

const TEST_DESTINATION = "8801615069178";
const TEST_OTP_CODE    = "246801";
const TEST_SENDER      = "TestVoiceOTP";
const TEST_CONTENT     = `Your OTP code is ${TEST_OTP_CODE}. Do not share.`;

const RETRY_COUNT = 2;
const PLAY_COUNT  = 2;

const SIP_HOST     = "127.0.0.1";   // local Asterisk
const SIP_PORT     = 5060;
const SIP_USERNAME = "net2app";     // local AMI user from install.sh
const SIP_PASSWORD = "Telco1988";   // local AMI secret
const CALLER_ID    = "Net2APP";

// ═══════════════════════════════════════════════════════════════

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   Voice OTP — Real Test Call                ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`\n  Destination : ${TEST_DESTINATION}`);
  console.log(`  OTP Code    : ${TEST_OTP_CODE}`);
  console.log(`  Retries     : ${RETRY_COUNT}`);
  console.log(`  Play Count  : ${PLAY_COUNT}`);
  console.log(`  SIP Server  : ${SIP_HOST}:${SIP_PORT}`);

  // ── 1. Find tenant ──
  const { rows: tenants } = await pool.query(
    "SELECT id, schema_name, company_name, email FROM tenants WHERE is_active = true ORDER BY id LIMIT 1"
  );
  if (tenants.length === 0) {
    console.error("❌ No active tenants found");
    process.exit(1);
  }
  const t = tenants[0];
  console.log(`\n📋 Tenant: ${t.company_name} (schema: ${t.schema_name}, id: ${t.id})`);
  await pool.query(`SET search_path TO "${t.schema_name}"`);

  // ── 2. Update/Insert Voice OTP Config — Bangladesh, retry=2, play=2 ──
  console.log("\n─── Voice OTP Config ───");
  const { rows: existingConfigs } = await pool.query(
    `SELECT id, country_group, play_count, retry_count, bilingual
     FROM voice_otp_config
     WHERE prefixes ILIKE '%+880%' AND is_active = true
     ORDER BY id LIMIT 1`
  );

  if (existingConfigs.length > 0) {
    // Update existing Bangla config
    await pool.query(
      `UPDATE voice_otp_config SET play_count = $1, retry_count = $2 WHERE id = $3`,
      [PLAY_COUNT, RETRY_COUNT, existingConfigs[0].id]
    );
    console.log(`  ✅ Updated config #${existingConfigs[0].id}: play_count=${PLAY_COUNT}, retry_count=${RETRY_COUNT} (was play=${existingConfigs[0].play_count}, retry=${existingConfigs[0].retry_count})`);
  } else {
    // Create new Bangla config
    const { rows: [newConfig] } = await pool.query(
      `INSERT INTO voice_otp_config (country_group, prefixes, primary_language, secondary_language, play_count, retry_count, bilingual, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING id`,
      ["Bangladesh Test", "+880", "Bangla", "English", PLAY_COUNT, RETRY_COUNT, false]
    );
    console.log(`  ✅ Created new config #${newConfig.id}: play_count=${PLAY_COUNT}, retry_count=${RETRY_COUNT}`);
  }

  // ── 3. Insert/Update SIP Config ──
  console.log("\n─── SIP Config ───");
  const { rows: existingSip } = await pool.query(
    `SELECT id, name, sip_host, sip_port, is_active
     FROM voice_otp_sip_config
     WHERE sip_host = $1 AND sip_port = $2
     ORDER BY id LIMIT 1`,
    [SIP_HOST, SIP_PORT]
  );

  if (existingSip.length > 0) {
    await pool.query(
      `UPDATE voice_otp_sip_config SET is_active = true, sip_username = $1, sip_password = $2, caller_id = $3, max_retries = $4 WHERE id = $5`,
      [SIP_USERNAME, SIP_PASSWORD, CALLER_ID, RETRY_COUNT, existingSip[0].id]
    );
    console.log(`  ✅ Updated SIP config #${existingSip[0].id}: ${SIP_HOST}:${SIP_PORT} (active=true)`);
  } else {
    const { rows: [newSip] } = await pool.query(
      `INSERT INTO voice_otp_sip_config (name, sip_host, sip_port, sip_username, sip_password, caller_id, max_retries, timeout, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 30, true) RETURNING id`,
      ["SIP Server - 198.27.80.229", SIP_HOST, SIP_PORT, SIP_USERNAME, SIP_PASSWORD, CALLER_ID, RETRY_COUNT]
    );
    console.log(`  ✅ Created SIP config #${newSip.id}: ${SIP_HOST}:${SIP_PORT} (active=true, max_retries=${RETRY_COUNT})`);
  }

  // ── 4. Ensure routing infrastructure exists ──
  console.log("\n─── Routing Check ───");

  // Find or create Voice OTP supplier
  let { rows: suppliers } = await pool.query(
    `SELECT id, name FROM suppliers WHERE connection_type = 'VOICE_OTP' AND is_active = true LIMIT 1`
  );
  let supplierId: number;
  if (suppliers.length > 0) {
    supplierId = suppliers[0].id;
    console.log(`  📞 Supplier: #${supplierId} "${suppliers[0].name}"`);
  } else {
    const { rows: [s] } = await pool.query(
      `INSERT INTO suppliers (name, connection_type, connection_mode, bind_status, is_active, force_dlr)
       VALUES ('Voice OTP Supplier', 'VOICE_OTP', 'CLIENT', 'UNBOUND', true, true) RETURNING id, name`
    );
    supplierId = s.id;
    console.log(`  📞 Created Supplier: #${supplierId} "${s.name}"`);
  }

  // Find or create trunk
  let { rows: trunks } = await pool.query(
    `SELECT id, name FROM trunks WHERE supplier_id = $1 AND is_active = true LIMIT 1`,
    [supplierId]
  );
  let trunkId: number;
  if (trunks.length > 0) {
    trunkId = trunks[0].id;
    console.log(`  🔗 Trunk: #${trunkId} "${trunks[0].name}"`);
  } else {
    const { rows: [tr] } = await pool.query(
      `INSERT INTO trunks (name, supplier_id, capacity, is_active) VALUES ('Voice OTP Trunk', $1, 100, true) RETURNING id, name`,
      [supplierId]
    );
    trunkId = tr.id;
    console.log(`  🔗 Created Trunk: #${trunkId} "${tr.name}"`);
  }

  // Find or create route
  let { rows: routes } = await pool.query(
    `SELECT id, name FROM routes WHERE trunk_id = $1 AND is_active = true LIMIT 1`,
    [trunkId]
  );
  let routeId: number;
  if (routes.length > 0) {
    routeId = routes[0].id;
    console.log(`  🛤️  Route: #${routeId} "${routes[0].name}"`);
  } else {
    const { rows: [r] } = await pool.query(
      `INSERT INTO routes (name, trunk_id, priority, is_active) VALUES ('Voice OTP Route', $1, 1, true) RETURNING id, name`,
      [trunkId]
    );
    routeId = r.id;
    console.log(`  🛤️  Created Route: #${routeId} "${r.name}"`);
  }

  // Find or create route plan
  let { rows: plans } = await pool.query(
    `SELECT rp.id, rp.name FROM route_plans rp
     JOIN route_plan_routes rpr ON rp.id = rpr.route_plan_id
     WHERE rpr.route_id = $1 LIMIT 1`,
    [routeId]
  );
  let planId: number;
  if (plans.length > 0) {
    planId = plans[0].id;
    console.log(`  📋 Plan: #${planId} "${plans[0].name}"`);
  } else {
    const { rows: [p] } = await pool.query(
      `INSERT INTO route_plans (name, is_active) VALUES ('Voice OTP Plan', true) RETURNING id, name`
    );
    planId = p.id;
    await pool.query(
      `INSERT INTO route_plan_routes (route_plan_id, route_id, priority) VALUES ($1, $2, 1)`,
      [planId, routeId]
    );
    console.log(`  📋 Created Plan: #${planId} "${p.name}" (route #${routeId} linked)`);
  }

  // Find client and assign plan
  const { rows: clients } = await pool.query(
    "SELECT id, name, http_api_key FROM clients WHERE is_active = true LIMIT 1"
  );
  if (clients.length === 0) {
    console.error("❌ No active clients found");
    process.exit(1);
  }
  const client = clients[0];
  await pool.query(
    `UPDATE clients SET route_plan_id = $1, dlr_callback_url = $2 WHERE id = $3`,
    [planId, "https://webhook.site/test-dlr-callback", client.id]
  );
  console.log(`  👤 Client: #${client.id} "${client.name}" — assigned plan #${planId}`);

  await pool.query("SET search_path TO public");

  // ── 5. Make the test call via HTTP API ──
  console.log("\n═══════════════════════════════════════════════");
  console.log("  📞 Initiating Voice OTP Call...");
  console.log("═══════════════════════════════════════════════\n");

  const baseUrl = process.env.BASE_URL || "http://localhost:3000";

  // Generate JWT for auth
  const jwtToken = createToken({
    tenantId: t.id,
    email: t.email,
    schemaName: t.schema_name,
    companyName: t.company_name || "Tenant",
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000); // 2 min for retries

    const res = await fetch(`${baseUrl}/api/tenant/send-sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `tenant_token=${jwtToken}`,
        "x-api-key": client.http_api_key || "",
      },
      body: JSON.stringify({
        sender: TEST_SENDER,
        destination: TEST_DESTINATION,
        content: TEST_CONTENT,
        clientId: client.id,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json();
    console.log(`\n📬 Response (HTTP ${res.status}):`);
    console.log(JSON.stringify(data, null, 2));

    if (res.ok && data.success) {
      console.log("\n✅ Voice OTP call submitted successfully!");
      if (data.routing) {
        console.log(`   Route Plan : ${data.routing.routePlan}`);
        console.log(`   Route      : ${data.routing.route}`);
        console.log(`   Supplier   : ${data.routing.supplier}`);
        console.log(`   Conn Type  : ${data.routing.connectionType}`);
      }
      if (data.voiceOtp) {
        console.log(`\n📞 Voice OTP Result:`);
        console.log(`   OTP Code    : ${data.voiceOtp.otpCode}`);
        console.log(`   Language    : ${data.voiceOtp.language}`);
        console.log(`   Country     : ${data.voiceOtp.country}`);
        console.log(`   Status      : ${data.voiceOtp.status}`);
        console.log(`   Call SID    : ${data.voiceOtp.callSid}`);
        console.log(`   Attempts    : ${data.voiceOtp.attemptCount}`);
        if (data.voiceOtp.attempts) {
          for (const a of data.voiceOtp.attempts) {
            console.log(`     • Attempt ${a.attempt}: lang=${a.language}, status=${a.status}, duration=${a.duration}s${a.errorMessage ? `, error="${a.errorMessage}"` : ''}`);
          }
        }
      }
      if (data.dlr) {
        console.log(`\n📨 DLR: status=${data.dlr.status}, pushed_to=${data.dlr.pushed_to}`);
      }
    } else {
      console.error(`\n❌ Call failed: ${data.error || 'Unknown error'}`);
      if (data.voiceOtp) {
        console.error(`   Call SID: ${data.voiceOtp.callSid}`);
        console.error(`   Attempts: ${data.voiceOtp.attemptCount}`);
        if (data.voiceOtp.attempts) {
          for (const a of data.voiceOtp.attempts) {
            console.error(`     • Attempt ${a.attempt}: ${a.status}${a.errorMessage ? ` — ${a.errorMessage}` : ''}`);
          }
        }
      }
    }
  } catch (err) {
    console.error(`\n❌ Request failed: ${(err as Error).message}`);
    if ((err as Error).message?.includes("abort")) {
      console.error("   (Request timed out after 120s — retry logic may be still running)");
    }
  }

  // ── 6. Check call logs in DB ──
  console.log("\n─── Call Logs (DB) ───");
  await pool.query(`SET search_path TO "${t.schema_name}"`);

  const { rows: callLogs } = await pool.query(
    `SELECT id, call_sid, destination, otp_code, language, status, attempt_count, duration, country, mcc, sip_config_name, created_at
     FROM voice_otp_call_logs ORDER BY id DESC LIMIT 5`
  );
  if (callLogs.length > 0) {
    for (const log of callLogs) {
      console.log(`\n  📋 Call #${log.id}: sid="${log.call_sid}"`);
      console.log(`     Destination : ${log.destination}`);
      console.log(`     OTP Code    : ${log.otp_code}`);
      console.log(`     Language    : ${log.language}`);
      console.log(`     Status      : ${log.status}`);
      console.log(`     Attempts    : ${log.attempt_count}`);
      console.log(`     Duration    : ${log.duration}ms`);
      console.log(`     Country     : ${log.country} (MCC ${log.mcc})`);
      console.log(`     SIP Config  : ${log.sip_config_name || '—'}`);
      console.log(`     Created     : ${log.created_at}`);
    }
  } else {
    console.log("  (no call logs found)");
  }

  // Check messages
  const { rows: msgs } = await pool.query(
    `SELECT id, message_id, sender, destination, content, status, connection_type, dlr_status, otp_code, language, cost, created_at
     FROM messages WHERE connection_type = 'VOICE_OTP' ORDER BY id DESC LIMIT 3`
  );
  if (msgs.length > 0) {
    console.log("\n─── Recent Voice OTP Messages ───");
    for (const m of msgs) {
      console.log(`  📨 #${m.id}: msg_id="${m.message_id}", status="${m.status}", dlr="${m.dlr_status}", otp="${m.otp_code}", lang="${m.language}", created=${m.created_at}`);
    }
  }

  await pool.query("SET search_path TO public");
  await pool.end();

  console.log("\n═══════════════════════════════════════════════");
  console.log("  Done.");
  console.log("═══════════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  pool.end().catch(() => {});
  process.exit(1);
});
