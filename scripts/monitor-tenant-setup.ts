#!/usr/bin/env npx tsx
/**
 * monitor-tenant-setup.ts — create a monitoring tenant on THIS server (idempotent).
 *
 * Per server creates:
 *   - tenant schema  tenant_monitor_<TAG>
 *   - tenant row (dashboard login: monitor-<TAG>@net2app.com / given password)
 *   - one SMPP CLIENT  (monitor_<TAG>)          — ESME identity you bind as to submit SMS
 *   - one SERVER-mode SUPPLIER (monitor_supp_<TAG>) — the sim gateway binds IN to receive MT
 *   - route plan → trunk → route → supplier, wired to the client (so submit_sm flows)
 *
 * Usage (run ON the target server inside /opt/net2app):
 *   SERVER_TAG=sydney npx tsx scripts/monitor-tenant-setup.ts
 *
 * Env:
 *   SERVER_TAG  — short tag: origin | france | germany | sydney | sydney2 (default: dev)
 *   TENANT_PASS — dashboard login password (default: Monitor@2026)
 *   SMPP_PASS   — SMPP bind password for client + supplier (default: Smpp@2026)
 *   TENANT_EMAIL_DOMAIN — default net2app.com
 */
import { pool } from "@/db";
import { createTenantSchema, seedMccMncRates } from "@/lib/tenant-schema";
import { hashPassword } from "@/lib/auth";
import { getSelfIp } from "@/lib/server-ips";

const TAG = process.env.SERVER_TAG || "dev";
const TENANT_PASS = process.env.TENANT_PASS || "Monitor@2026";
const SMPP_PASS = process.env.SMPP_PASS || "Smpp@2026";
const DOMAIN = process.env.TENANT_EMAIL_DOMAIN || "net2app.com";

async function main() {
  const schema = `tenant_monitor_${TAG}`;
  const selfIp = await getSelfIp();
  const ip = selfIp === "127.0.0.1" ? (process.env.SERVER_IP || "127.0.0.1") : selfIp;

  // 1. Tenant schema (self-healing — builds every table)
  await createTenantSchema(schema);

  // 2. Tenant row with real bcrypt password (dashboard login works)
  const email = `monitor-${TAG}@${DOMAIN}`;
  const passwordHash = await hashPassword(TENANT_PASS);
  const { rows: existingT } = await pool.query("SELECT id FROM tenants WHERE email = $1", [email]);
  let tenantId: number;
  if (existingT.length === 0) {
    const r = await pool.query(
      `INSERT INTO tenants (company_name, email, phone, password_hash, schema_name, smpp_server_ip, is_active, sms_limit, balance, package_type, status)
       VALUES ($1, $2, '00000000000', $3, $4, $5, true, 1000000, '0', 'starter', 'active') RETURNING id`,
      [`Monitor ${TAG}`, email, passwordHash, schema, ip]
    );
    tenantId = r.rows[0].id;
  } else {
    tenantId = existingT[0].id;
  }

  // Seed MCC/MNC rates so client_rates/supplier_rates exist with defaults
  await seedMccMncRates(schema).catch((e: Error) => console.error("MCC/MNC seed failed:", e.message));

  await pool.query(`SET search_path TO "${schema}"`);

  // 3. One SMPP client (ESME identity — bind as this to submit SMS)
  let clientId: number;
  {
    const { rows } = await pool.query("SELECT id FROM clients WHERE smpp_username = $1", [`monitor_${TAG}`]);
    if (rows.length > 0) clientId = rows[0].id;
    else {
      const r = await pool.query(
        `INSERT INTO clients (name, email, phone, connection_type, smpp_username, smpp_password, smpp_allowed_ip, is_active)
         VALUES ('Monitor Client ${TAG}', $1, '00000000000', 'SMPP', $2, $3, NULL, true) RETURNING id`,
        [`monitor-client-${TAG}@${DOMAIN}`, `monitor_${TAG}`, SMPP_PASS]
      );
      clientId = r.rows[0].id;
    }
  }

  // 4. One SERVER-mode supplier (sim gateway binds in to receive MT + return DLR)
  let supplierId: number;
  {
    const { rows } = await pool.query("SELECT id FROM suppliers WHERE username = $1", [`monitor_supp_${TAG}`]);
    if (rows.length > 0) supplierId = rows[0].id;
    else {
      const r = await pool.query(
        `INSERT INTO suppliers (name, connection_type, connection_mode, username, password, system_id, system_type, smpp_version, bind_type, is_active)
         VALUES ('Monitor Supplier ${TAG}', 'SMPP', 'SERVER', $1, $2, $1, 'SMSC', '3.4', 'TRX', true) RETURNING id`,
        [`monitor_supp_${TAG}`, SMPP_PASS]
      );
      supplierId = r.rows[0].id;
    }
  }

  // 5. Route wiring: client route plan → trunk → route → supplier
  {
    const { rows } = await pool.query("SELECT id FROM route_plans WHERE name = $1", [`Monitor Plan ${TAG}`]);
    let planId: number;
    if (rows.length > 0) planId = rows[0].id;
    else {
      const r = await pool.query("INSERT INTO route_plans (name, is_active) VALUES ($1, true) RETURNING id", [`Monitor Plan ${TAG}`]);
      planId = r.rows[0].id;
    }
    let trunkId: number;
    {
      const { rows: tr } = await pool.query("SELECT id FROM trunks WHERE name = $1", [`Monitor Trunk ${TAG}`]);
      if (tr.length > 0) trunkId = tr[0].id;
      else {
        const r = await pool.query(
          "INSERT INTO trunks (name, supplier_id, capacity, is_active) VALUES ($1, $2, 100, true) RETURNING id",
          [`Monitor Trunk ${TAG}`, supplierId]
        );
        trunkId = r.rows[0].id;
      }
    }
    let routeId: number;
    {
      const { rows: rr } = await pool.query("SELECT id FROM routes WHERE name = $1", [`Monitor Route ${TAG}`]);
      if (rr.length > 0) routeId = rr[0].id;
      else {
        const r = await pool.query(
          "INSERT INTO routes (name, trunk_id, priority, is_active) VALUES ($1, $2, 1, true) RETURNING id",
          [`Monitor Route ${TAG}`, trunkId]
        );
        routeId = r.rows[0].id;
      }
    }
    await pool.query(
      "INSERT INTO route_plan_routes (route_plan_id, route_id, priority) VALUES ($1, $2, 1) ON CONFLICT DO NOTHING",
      [planId, routeId]
    );
    await pool.query("UPDATE clients SET route_plan_id = $1 WHERE id = $2", [planId, clientId]);
  }

  await pool.query(`SET search_path TO public`);

  console.log(JSON.stringify({
    ok: true,
    tag: TAG,
    serverIp: ip,
    tenant: { id: tenantId, schema, email, password: TENANT_PASS },
    client: { id: clientId, smppUsername: `monitor_${TAG}`, smppPassword: SMPP_PASS },
    supplier: { id: supplierId, smppUsername: `monitor_supp_${TAG}`, smppPassword: SMPP_PASS, mode: "SERVER" },
  }));
  await pool.end();
  process.exit(0);
}

main().catch((e) => { console.error("SETUP_ERR", e.message); process.exit(1); });
