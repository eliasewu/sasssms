import { Pool } from "pg";
import { createNonExpiringToken } from "../src/lib/auth";

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query(
    "SELECT id, email, schema_name, company_name FROM tenants WHERE is_active = true ORDER BY id LIMIT 10"
  );
  for (const t of rows) {
    const token = createNonExpiringToken({
      tenantId: t.id,
      email: t.email,
      schemaName: t.schema_name,
      companyName: t.company_name,
    });
    console.log(
      `tenant_id=${t.id} company=${t.company_name}\n  https://net2app.com/api/tenant/android-app/download?token=${encodeURIComponent(token)}\n`
    );
  }
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
