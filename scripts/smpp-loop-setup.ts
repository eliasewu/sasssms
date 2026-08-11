#!/usr/bin/env npx tsx
/**
 * smpp-loop-setup.ts — create the SMPP interconnect test tenant on THIS server.
 *
 * Creates (idempotent):
 *   - tenant schema  tenant_smpptest_<TAG>
 *   - tenant row (active, assigned to this server)
 *   - one SMPP CLIENT  (smpptest_<TAG> / test1234)  — the ESME identity the
 *     NEIGHBOUR server's load generator binds as
 *   - one SERVER-mode SUPPLIER (smpptest_supp_<TAG> / test1234) — lets the app
 *     register inbound binds as a supplier (test-only)
 *
 * Usage:
 *   SERVER_TAG=dev SERVER_IP=15.235.35.125 npx tsx scripts/smpp-loop-setup.ts
 */
import { pool } from "@/db";
import { createTenantSchema } from "@/lib/tenant-schema";

const TAG = process.env.SERVER_TAG || "dev";
const IP = process.env.SERVER_IP || "15.235.35.125";
const PASSWORD = "test1234";

async function main() {
  const schema = `tenant_smpptest_${TAG}`;

  // 1. Tenant schema (self-healing createTenantSchema builds every table)
  await createTenantSchema(schema);

  // 2. Tenant row (idempotent — NOT EXISTS guard, no reliance on unique email index)
  const email = `smpptest-${TAG}@test.local`;
  const { rows: existingT } = await pool.query(
    "SELECT id FROM tenants WHERE email = $1",
    [email]
  );
  if (existingT.length === 0) {
    await pool.query(
      `INSERT INTO tenants (company_name, email, phone, password_hash, schema_name, smpp_server_ip, is_active, sms_limit, balance, package_type, status)
       VALUES ($1, $2, '00000000000', 'x', $3, $4, true, 1000000, '0', 'starter', 'active')`,
      [`SMPP Test ${TAG}`, email, schema, IP]
    );
  }

  await pool.query(`SET search_path TO "${schema}"`);

  // 3. One SMPP client (ESME creds the neighbour binds as)
  const clientEmail = `smpptest-client-${TAG}@test.local`;
  const { rows: existingC } = await pool.query(
    "SELECT id FROM clients WHERE smpp_username = $1",
    [`smpptest_${TAG}`]
  );
  if (existingC.length === 0) {
    await pool.query(
      `INSERT INTO clients (name, email, phone, connection_type, smpp_username, smpp_password, smpp_allowed_ip, is_active)
       VALUES ('SMPP Test Client', $1, '00000000000', 'SMPP', $2, $3, NULL, true)`,
      [clientEmail, `smpptest_${TAG}`, PASSWORD]
    );
  }

  // 4. One SERVER-mode supplier (registers IN to this server's SMSC)
  const { rows: existingS } = await pool.query(
    "SELECT id FROM suppliers WHERE username = $1",
    [`smpptest_supp_${TAG}`]
  );
  if (existingS.length === 0) {
    await pool.query(
      `INSERT INTO suppliers (name, connection_type, connection_mode, username, password, system_id, bind_status, is_active)
       VALUES ('SMPP Test Supplier', 'SMPP', 'SERVER', $1, $2, $1, 'UNBOUND', true)`,
      [`smpptest_supp_${TAG}`, PASSWORD]
    );
  }

  await pool.query(`SET search_path TO public`);
  const { rows: ver } = await pool.query(
    `SELECT
       (SELECT count(*) FROM pg_tables WHERE schemaname = '${schema}') AS tables,
       (SELECT count(*) FROM tenants WHERE schema_name = '${schema}') AS tenant_row
     FROM tenants LIMIT 1`
  );
  console.log(`SETUP_OK schema=${schema} tables=${ver[0].tables} tenant_row=${ver[0].tenant_row}`);
  await pool.end();
  process.exit(0);
}

main().catch((e) => { console.error("SETUP_ERR", e.message); process.exit(1); });
