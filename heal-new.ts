import { pool } from "@/db";
import { createTenantSchema } from "@/lib/tenant-schema";

async function main() {
  const { rows } = await pool.query(
    "SELECT schema_name FROM tenants WHERE is_active = true ORDER BY id"
  );
  console.log(`Healing ${rows.length} tenant schemas...`);
  let ok = 0;
  let failed = 0;
  for (const r of rows) {
    try {
      await createTenantSchema(r.schema_name);
      console.log("HEALED", r.schema_name);
      ok++;
    } catch (e) {
      console.error("FAILED", r.schema_name, (e as Error).message);
      failed++;
    }
  }
  console.log(`Done. ok=${ok} failed=${failed}`);
  await pool.end();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
