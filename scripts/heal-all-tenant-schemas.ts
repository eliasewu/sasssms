/**
 * One-off heal: reconcile ALL existing tenant schemas against the current
 * TENANT_TABLE_DEFS (single source of truth) and ALTER any missing columns.
 *
 * This is the same reconciliation the self-healing createTenantSchema runs on
 * every touch — run it once to heal every existing schema immediately instead
 * of waiting for each tenant to be touched (login / registration sync).
 *
 * Run: npx tsx scripts/heal-all-tenant-schemas.ts
 */
import { pool } from "@/db";
import { TENANT_TABLE_DEFS, extractColumnDefs } from "@/lib/tenant-schema";

// Columns the PUBLIC tenants table must have (added by drizzle migrations
// 0020/0026/0037 etc. — fleet servers that never ran the migrations drift and
// every tenant login on them 500s with "column does not exist").
const PUBLIC_TENANT_COLUMNS: string[] = [
  "google_id varchar(255)",
  "mms_forward_enabled boolean NOT NULL DEFAULT true",
  "auto_connect_enabled boolean NOT NULL DEFAULT true",
  "max_tps integer NOT NULL DEFAULT 0",
  "max_concurrent_calls integer NOT NULL DEFAULT 10",
  "server_location varchar(100)",
  "status varchar(20) NOT NULL DEFAULT 'active'",
  "email_verified boolean NOT NULL DEFAULT false",
  "phone_verified boolean NOT NULL DEFAULT false",
  "auto_renew_enabled boolean NOT NULL DEFAULT true",
  "account_expires_at timestamp without time zone",
];

async function healPublicTenantsTable(client: any): Promise<{ added: number; failed: number }> {
  let added = 0;
  let failed = 0;
  const { rows: existingRows } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants'`
  );
  const existing = new Set(existingRows.map((r: any) => r.column_name));
  for (const def of PUBLIC_TENANT_COLUMNS) {
    const colName = def.split(/\s+/)[0];
    if (existing.has(colName)) continue;
    try {
      await client.query(`ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ${def}`);
      console.log(`[HEAL] public.tenants.${colName} added`);
      added++;
    } catch (e) {
      console.error(`[HEAL] public.tenants.${colName} FAILED:`, (e as Error).message);
      failed++;
    }
  }
  // google_id must stay unique for the Google-sign-in flow
  await client.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_google_id ON public.tenants (google_id) WHERE google_id IS NOT NULL`
  ).catch(() => {
    // partial-index attempt fails on very old PG; plain unique index is fine
    return client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_google_id ON public.tenants (google_id)`
    );
  });
  return { added, failed };
}

async function healVoiceOtpAudioIndex(client: any, schema: string): Promise<number> {
  // The upload route upserts with ON CONFLICT (config_id, language, digit) which
  // REQUIRES the unique index. Old schemas lack it, and pre-existing duplicate
  // rows block index creation — so dedupe first (keep the newest row per key).
  try {
    await client.query(
      `DELETE FROM "${schema}".voice_otp_audio a WHERE a.id < (SELECT MAX(b.id) FROM "${schema}".voice_otp_audio b WHERE b.config_id = a.config_id AND b.language = a.language AND b.digit = a.digit)`
    );
    await client.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS voice_otp_audio_uniq ON "${schema}".voice_otp_audio USING btree (config_id, language, digit)`
    );
    return 0;
  } catch (e) {
    console.error(`[HEAL] ${schema}.voice_otp_audio index FAILED:`, (e as Error).message);
    return 1;
  }
}

async function main() {
  const client = await pool.connect();
  try {
    const expected = extractColumnDefs(TENANT_TABLE_DEFS);
    const pub = await healPublicTenantsTable(client);
    console.log(`Healed public.tenants: ${pub.added} columns added, ${pub.failed} failed.`);
    const { rows: tenants } = await client.query(
      "SELECT t.schema_name FROM tenants t WHERE t.is_active = true AND EXISTS (SELECT 1 FROM pg_namespace n WHERE n.nspname = t.schema_name) ORDER BY t.id"
    );

    console.log(`Healing ${tenants.length} active tenant schemas...\n`);
    let totalAdded = 0;
    let totalFailed = 0;
    let indexFailures = 0;

    for (const t of tenants) {
      const schema = t.schema_name as string;
      if (!/^[a-z0-9_]+$/.test(schema)) {
        console.log(`[HEAL] SKIP ${schema} (unsafe schema name)`);
        continue;
      }
      for (const [table, defs] of Object.entries(expected)) {
        // If the table is missing entirely, create it from the bootstrap DDL
        // (old schemas predate tables added later — e.g. dlr_webhook_logs).
        const { rows: tblExists } = await client.query(
          `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`,
          [schema, table]
        );
        if (tblExists.length === 0) {
          const def = TENANT_TABLE_DEFS.find((d) => d.table === table);
          if (def) {
            try {
              await client.query(def.sql.replace(/^CREATE TABLE IF NOT EXISTS\s+(\S+)/, `CREATE TABLE IF NOT EXISTS "${schema}".$1`));
              console.log(`[HEAL] ${schema}.${table} table created`);
              totalAdded++;
            } catch (e) {
              console.error(`[HEAL] ${schema}.${table} table CREATE FAILED:`, (e as Error).message);
              totalFailed++;
            }
          }
          continue;
        }
        let existing: Set<string>;
        try {
          const res = await client.query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2`,
            [schema, table]
          );
          existing = new Set(res.rows.map((r) => r.column_name));
        } catch {
          continue; // table doesn't exist in this schema — skip
        }
        for (const def of defs) {
          const colName = def.split(/\s+/)[0];
          if (existing.has(colName)) continue;
          try {
            await client.query(
              `ALTER TABLE "${schema}"."${table}" ADD COLUMN IF NOT EXISTS ${def}`
            );
            console.log(`[HEAL] ${schema}.${table}.${colName} added`);
            totalAdded++;
          } catch (e) {
            console.error(`[HEAL] ${schema}.${table}.${colName} FAILED:`, (e as Error).message);
            totalFailed++;
          }
        }
        // Voice OTP audio upsert needs its unique index (dedupe first).
        if (table === "voice_otp_audio") {
          indexFailures += await healVoiceOtpAudioIndex(client, schema);
        }
      }
    }

    console.log(`\nDone: ${totalAdded} columns added, ${totalFailed} failed, ${indexFailures} voice_otp_audio index failures.`);
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
