#!/usr/bin/env npx tsx
/**
 * test-voice-otp-direct.ts
 *
 * DIRECT Voice OTP engine test — calls executeVoiceOtpCall() directly
 * bypassing the HTTP API layer (which crashes due to pre-existing SMPP bugs).
 *
 * Parameters:
 *   - Destination:  8801615069178 (Bangladesh)
 *   - Retry count:  2
 *   - Play count:   2
 *   - SIP/AMI:      localhost (127.0.0.1:5038)
 */

import { pool } from "@/db";
import { executeVoiceOtpCall } from "@/lib/voice-otp-engine";

const DESTINATION = "8801615069178";
const OTP_CODE = "246801";
const RETRY_COUNT = 2;
const PLAY_COUNT = 2;
const SIP_HOST = "127.0.0.1";
const SIP_PORT = 5060;

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║   Voice OTP — Direct Engine Test            ║");
  console.log("╚══════════════════════════════════════════════╝");
  console.log(`  Destination : ${DESTINATION}`);
  console.log(`  OTP Code    : ${OTP_CODE}`);
  console.log(`  Retries     : ${RETRY_COUNT}`);
  console.log(`  Play Count  : ${PLAY_COUNT}`);
  console.log(`  SIP / AMI   : ${SIP_HOST}:${SIP_PORT} / ${SIP_HOST}:5038\n`);

  // ── 1. Find tenant ──
  const { rows: tenants } = await pool.query(
    "SELECT id, schema_name, company_name FROM tenants WHERE is_active = true ORDER BY id LIMIT 1"
  );
  if (tenants.length === 0) { console.error("No active tenants"); process.exit(1); }
  const t = tenants[0];
  console.log(`📋 Tenant: ${t.company_name} (schema: ${t.schema_name}, id: ${t.id})`);

  // ── 2. Seed configs ──
  await pool.query(`SET search_path TO "${t.schema_name}"`);

  // Update/create Voice OTP config for Bangladesh
  const { rows: configs } = await pool.query(
    `SELECT id, play_count, retry_count FROM voice_otp_config WHERE prefixes ILIKE '%+880%' AND is_active = true LIMIT 1`
  );
  if (configs.length > 0) {
    await pool.query(`UPDATE voice_otp_config SET play_count=$1, retry_count=$2 WHERE id=$3`,
      [PLAY_COUNT, RETRY_COUNT, configs[0].id]);
    console.log(`  ✅ Voice OTP config #${configs[0].id}: play=${PLAY_COUNT}, retry=${RETRY_COUNT}`);
  } else {
    const { rows: [nc] } = await pool.query(
      `INSERT INTO voice_otp_config (country_group, prefixes, primary_language, play_count, retry_count, is_active)
       VALUES ('Bangladesh','+880','Bangla',$1,$2,true) RETURNING id`, [PLAY_COUNT, RETRY_COUNT]);
    console.log(`  ✅ Created config #${nc.id}: play=${PLAY_COUNT}, retry=${RETRY_COUNT}`);
  }

  // Deactivate all non-localhost SIP configs first (engine picks lowest-id active)
  await pool.query(`UPDATE voice_otp_sip_config SET is_active = false WHERE sip_host NOT IN ('127.0.0.1', 'localhost')`);
  
  // Update/create SIP config for localhost
  const { rows: sips } = await pool.query(
    `SELECT id FROM voice_otp_sip_config WHERE sip_host=$1 AND sip_port=$2 LIMIT 1`, [SIP_HOST, SIP_PORT]
  );
  if (sips.length > 0) {
    await pool.query(`UPDATE voice_otp_sip_config SET is_active=true, name='Local Asterisk', sip_username='net2app', sip_password='Telco1988', caller_id='Net2APP', max_retries=$1, timeout=30 WHERE id=$2`,
      [RETRY_COUNT, sips[0].id]);
    console.log(`  ✅ SIP config #${sips[0].id}: ${SIP_HOST}:${SIP_PORT}`);
  } else {
    const { rows: [ns] } = await pool.query(
      `INSERT INTO voice_otp_sip_config (name, sip_host, sip_port, sip_username, sip_password, caller_id, max_retries, timeout, is_active)
       VALUES ('Local Asterisk',$1,$2,'net2app','Telco1988','Net2APP',$3,30,true) RETURNING id`,
      [SIP_HOST, SIP_PORT, RETRY_COUNT]);
    console.log(`  ✅ Created SIP config #${ns.id}: ${SIP_HOST}:${SIP_PORT}`);
  }

  // Ensure Voice OTP supplier exists
  let { rows: suppliers } = await pool.query(
    `SELECT id FROM suppliers WHERE connection_type='VOICE_OTP' AND is_active=true LIMIT 1`
  );
  let supplierId: number | null;
  if (suppliers.length > 0) {
    supplierId = suppliers[0].id;
    console.log(`  📞 Supplier: #${supplierId}`);
  } else {
    const { rows: [s] } = await pool.query(
      `INSERT INTO suppliers (name, connection_type, connection_mode, bind_status, is_active, force_dlr)
       VALUES ('Voice OTP Supplier','VOICE_OTP','CLIENT','UNBOUND',true,true) RETURNING id`
    );
    supplierId = s.id;
    console.log(`  📞 Created Supplier: #${supplierId}`);
  }

  await pool.query("SET search_path TO public");

  // ── 3. Execute Voice OTP call directly ──
  console.log("\n═══════════════════════════════════════════════");
  console.log("  📞 Executing Voice OTP Call (direct)...");
  console.log("═══════════════════════════════════════════════\n");

  const startTime = Date.now();
  let result;
  try {
    result = await executeVoiceOtpCall({
      schemaName: t.schema_name,
      tenantId: t.id,
      destination: DESTINATION,
      sender: "TestVoiceOTP",
      otpCode: OTP_CODE,
      messageId: `VOTP_DIRECT_${Date.now()}`,
      supplierId,
      maxConcurrentCalls: 10,
    });
  } catch (err) {
    console.error(`\n💥 executeVoiceOtpCall threw: ${(err as Error).message}`);
    console.error((err as Error).stack);
    process.exit(1);
  }
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // ── 4. Report results ──
  console.log(`\n📊 Result (after ${elapsed}s):`);
  console.log(`   Success        : ${result.success}`);
  console.log(`   Call SID       : ${result.callSid}`);
  console.log(`   Language       : ${result.language}`);
  console.log(`   Country        : ${result.langResolution.country} (MCC ${result.langResolution.mcc})`);
  console.log(`   Primary Lang   : ${result.langResolution.primaryLanguage}`);
  console.log(`   Fallback Lang  : ${result.langResolution.fallbackLanguage}`);
  console.log(`   Total Duration : ${result.totalDuration}s`);
  console.log(`   SIP Config     : ${result.sipConfigName || '—'}`);
  if (result.errorMessage) console.log(`   Error          : ${result.errorMessage}`);

  console.log(`\n📞 Call Attempts (${result.callAttempts.length}):`);
  for (const att of result.callAttempts) {
    const icon = att.status === "ANSWERED" ? "✅" : att.status === "NO_ANSWER" ? "⏰" : att.status === "BUSY" ? "📵" : "❌";
    console.log(`   ${icon} Attempt ${att.attempt}: lang=${att.language}, status=${att.status}, duration=${att.duration}s, sipCallId=${att.sipCallId}${att.errorMessage ? `, error="${att.errorMessage}"` : ''}`);
    if (att.audioPlaylist.length > 0) {
      console.log(`      Playlist: ${att.audioPlaylist.length} items [${att.audioPlaylist.slice(0, 3).map(a => `${a.type}/${a.digit}`).join(', ')}${att.audioPlaylist.length > 3 ? '...' : ''}]`);
    }
  }

  // ── 5. Check DB call logs ──
  console.log("\n─── DB Call Logs ───");
  await pool.query(`SET search_path TO "${t.schema_name}"`);
  const { rows: logs } = await pool.query(
    `SELECT id, call_sid, destination, otp_code, language, status, attempt_count, duration, sip_config_name, created_at
     FROM voice_otp_call_logs ORDER BY id DESC LIMIT 5`
  );
  if (logs.length > 0) {
    for (const log of logs) {
      console.log(`  📋 #${log.id}: sid="${log.call_sid}" dest=${log.destination} otp=${log.otp_code} lang=${log.language} status=${log.status} attempts=${log.attempt_count} duration=${log.duration}ms sip=${log.sip_config_name||'—'} created=${log.created_at}`);
    }
  } else {
    console.log("  (no call logs)");
  }
  await pool.query("SET search_path TO public");

  // ── Summary ──
  console.log("\n═══════════════════════════════════════════════");
  if (result.success) {
    console.log("  ✅ Voice OTP call SUCCEEDED");
    console.log(`     Call SID: ${result.callSid}`);
    console.log(`     Attempts: ${result.callAttempts.length}`);
  } else {
    console.log("  ❌ Voice OTP call FAILED");
    console.log(`     Reason: ${result.errorMessage || 'unknown'}`);
  }
  console.log("═══════════════════════════════════════════════\n");

  await pool.end();
  process.exit(result.success ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  pool.end().catch(() => {});
  process.exit(1);
});
