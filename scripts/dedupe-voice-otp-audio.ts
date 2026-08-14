#!/usr/bin/env npx tsx
/**
 * dedupe-voice-otp-audio.ts — remove duplicate voice_otp_audio rows from every
 * tenant schema and add a unique index on (config_id, language, digit).
 *
 * Older seeds had no unique index, so repeated "Push to Tenants" runs could
 * leave duplicate rows with stale file_urls behind. This script:
 *   1. For each tenant schema, deletes all but the LOWEST-id row per
 *      (config_id, language, digit) — keeping whichever URL was written first.
 *   2. Adds a UNIQUE index on (config_id, language, digit) so future pushes
 *      (or tenant uploads) can never create duplicates again.
 *   3. Recomputes primary_audio_count / secondary_audio_count on each config.
 *
 * Run ON the target server inside /opt/net2app (with .env loaded):
 *   set -a && source .env && set +a && npx tsx scripts/dedupe-voice-otp-audio.ts
 */
import { pool } from "@/db";

async function main() {
  const { rows: tenants } = await pool.query(
    "SELECT schema_name FROM tenants WHERE is_active = true"
  );

  let schemasFixed = 0;
  let rowsRemoved = 0;
  let indexesAdded = 0;
  const errors: string[] = [];

  for (const t of tenants) {
    const schema = t.schema_name;
    try {
      // 1. Dedupe — keep lowest id per (config_id, language, digit)
      const removed = await pool.query(
        `DELETE FROM "${schema}".voice_otp_audio a
         USING "${schema}".voice_otp_audio b
         WHERE a.config_id = b.config_id
           AND a.language = b.language
           AND a.digit = b.digit
           AND a.id > b.id`
      );
      rowsRemoved += removed.rowCount ?? 0;

      // 2. Unique index (idempotent)
      const idx = await pool.query(
        `SELECT 1 FROM pg_indexes WHERE schemaname = $1 AND tablename = 'voice_otp_audio' AND indexname = 'voice_otp_audio_uniq'`,
        [schema]
      );
      if (idx.rows.length === 0) {
        await pool.query(
          `CREATE UNIQUE INDEX voice_otp_audio_uniq
           ON "${schema}".voice_otp_audio (config_id, language, digit)`
        );
        indexesAdded++;
      }

      // 3. Recompute audio counts on configs
      await pool.query(
        `UPDATE "${schema}".voice_otp_config c SET
           primary_audio_count = (SELECT COUNT(*) FROM "${schema}".voice_otp_audio a
             WHERE a.config_id = c.id AND a.language = c.primary_language),
           secondary_audio_count = (SELECT COUNT(*) FROM "${schema}".voice_otp_audio a
             WHERE a.config_id = c.id AND a.language = c.secondary_language)`
      );

      schemasFixed++;
    } catch (e) {
      errors.push(`${schema}: ${(e as Error).message}`);
      console.error(`Dedupe failed for ${schema}:`, (e as Error).message);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    schemasProcessed: tenants.length,
    schemasFixed,
    rowsRemoved,
    indexesAdded,
    errors: errors.length > 0 ? errors : undefined,
  }));
  await pool.end();
  process.exit(0);
}

main().catch((e) => { console.error("DEDUPE_ERR", e.message); process.exit(1); });
