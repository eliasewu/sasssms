#!/usr/bin/env npx tsx
/**
 * smpp-interconnect-setup.ts — create the cross-server SMPP interconnect test
 * entities on THIS server (idempotent).
 *
 * Ring topology (each server forwards to the NEXT one):
 *   dev → origin → france → germany → sydney → dev
 *
 * Per server S, in tenant schema `tenant_xconn_<S>`:
 *   - client  `itest_<S>`      outbound — the load generator binds as this on S.
 *                              Route plan → CLIENT-mode link supplier (→ NEXT).
 *   - client  `itest_in_<S>`   inbound — the PREVIOUS server's link supplier
 *                              binds to S as this (S's SMSC sees it as an ESME).
 *                              Route plan → SERVER-mode gateway supplier (terminates).
 *   - supplier `itest_link_<S>`  CLIENT mode, host=NEXT_IP:2775, binds as
 *                              `itest_in_<NEXT>` on the NEXT server.
 *   - supplier `itest_gw_<S>`    SERVER mode — the sim gateway binds in,
 *                              receives the MT (SUBMIT_SM), returns a DELIVRD DLR.
 *
 * Flow (S → NEXT): loadgen(itest_S) → S routes → link supplier → NEXT SMSC
 *   (ESME itest_in_NEXT) → NEXT routes → NEXT's gateway supplier → sim gw →
 *   DLR back through NEXT → S's supplier connection → S's client (loadgen).
 *
 * Usage (run ON the target server inside /opt/net2app):
 *   SERVER_TAG=dev SERVER_IP=15.235.35.125 \
 *   NEXT_TAG=origin NEXT_IP=149.56.22.232 \
 *   XCONN_PASS=... npx tsx scripts/smpp-interconnect-setup.ts
 */
import { pool } from "@/db";
import { createTenantSchema } from "@/lib/tenant-schema";

const TAG = process.env.SERVER_TAG || "dev";
const IP = process.env.SERVER_IP || "15.235.35.125";
const NEXT_TAG = process.env.NEXT_TAG || "origin";
const NEXT_IP = process.env.NEXT_IP || "149.56.22.232";
const PASS = process.env.XCONN_PASS || "xconn1234";

async function q(sql: string, params: any[] = []) {
  const r = await pool.query(sql, params);
  return r;
}

async function main() {
  const schema = `tenant_xconn_${TAG}`;
  await createTenantSchema(schema);

  // ── Tenant row ──
  const email = `xconn-${TAG}@test.local`;
  const { rows: existingT } = await pool.query("SELECT id FROM tenants WHERE email = $1", [email]);
  let tenantId: number;
  if (existingT.length === 0) {
    const r = await q(
      `INSERT INTO tenants (company_name, email, phone, password_hash, schema_name, smpp_server_ip, is_active, sms_limit, balance, package_type, status)
       VALUES ($1, $2, '00000000000', 'x', $3, $4, true, 1000000, '0', 'starter', 'active') RETURNING id`,
      [`XConn Test ${TAG}`, email, schema, IP]
    );
    tenantId = r.rows[0].id;
  } else {
    tenantId = existingT[0].id;
  }

  await pool.query(`SET search_path TO "${schema}"`);

  // ── Outbound client (loadgen identity) ──
  let outClientId: number;
  {
    const { rows } = await pool.query("SELECT id FROM clients WHERE smpp_username = $1", [`itest_${TAG}`]);
    if (rows.length > 0) outClientId = rows[0].id;
    else {
      const r = await q(
        `INSERT INTO clients (name, email, phone, connection_type, smpp_username, smpp_password, smpp_allowed_ip, is_active)
         VALUES ('XConn Out ${TAG}', $1, '00000000000', 'SMPP', $2, $3, NULL, true) RETURNING id`,
        [`xconn-out-${TAG}@test.local`, `itest_${TAG}`, PASS]
      );
      outClientId = r.rows[0].id;
    }
  }

  // ── Inbound client (prev server's link binds as this) ──
  let inClientId: number;
  {
    const { rows } = await pool.query("SELECT id FROM clients WHERE smpp_username = $1", [`itest_in_${TAG}`]);
    if (rows.length > 0) inClientId = rows[0].id;
    else {
      const r = await q(
        `INSERT INTO clients (name, email, phone, connection_type, smpp_username, smpp_password, smpp_allowed_ip, is_active)
         VALUES ('XConn In ${TAG}', $1, '00000000000', 'SMPP', $2, $3, NULL, true) RETURNING id`,
        [`xconn-in-${TAG}@test.local`, `itest_in_${TAG}`, PASS]
      );
      inClientId = r.rows[0].id;
    }
  }

  // ── CLIENT-mode link supplier → NEXT server ──
  // NOTE: the supplier's username is `itest_in_<NEXT>` (it binds as the NEXT
  // server's inbound client) — the idempotency lookup must use THAT username,
  // not `itest_link_<TAG>` (which would create duplicates on re-runs).
  let linkSuppId: number;
  {
    const { rows } = await pool.query("SELECT id FROM suppliers WHERE username = $1", [`itest_in_${NEXT_TAG}`]);
    if (rows.length > 0) linkSuppId = rows[0].id;
    else {
      const r = await q(
        `INSERT INTO suppliers (name, connection_type, connection_mode, host, port, username, password, system_id, system_type, smpp_version, bind_type, is_active)
         VALUES ('XConn Link ${TAG} → ${NEXT_TAG}', 'SMPP', 'CLIENT', $1, 2775, $2, $3, $2, 'SMSC', '3.4', 'TRX', true) RETURNING id`,
        [NEXT_IP, `itest_in_${NEXT_TAG}`, PASS]
      );
      linkSuppId = r.rows[0].id;
    }
  }

  // ── SERVER-mode gateway supplier (sim gateway binds in) ──
  let gwSuppId: number;
  {
    const { rows } = await pool.query("SELECT id FROM suppliers WHERE username = $1", [`itest_gw_${TAG}`]);
    if (rows.length > 0) gwSuppId = rows[0].id;
    else {
      const r = await q(
        `INSERT INTO suppliers (name, connection_type, connection_mode, username, password, system_id, system_type, is_active)
         VALUES ('XConn GW ${TAG}', 'SMPP', 'SERVER', $1, $2, $1, 'SMSC', true) RETURNING id`,
        [`itest_gw_${TAG}`, PASS]
      );
      gwSuppId = r.rows[0].id;
    }
  }

  // ── Routing: outbound client plan → link supplier ──
  {
    const { rows } = await pool.query("SELECT id FROM route_plans WHERE name = $1", [`XConn Out Plan ${TAG}`]);
    let planId: number;
    if (rows.length > 0) planId = rows[0].id;
    else {
      const r = await q("INSERT INTO route_plans (name, is_active) VALUES ($1, true) RETURNING id", [`XConn Out Plan ${TAG}`]);
      planId = r.rows[0].id;
    }
    // trunk → link supplier
    let trunkId: number;
    {
      const { rows: tr } = await pool.query("SELECT id FROM trunks WHERE name = $1", [`XConn Link Trunk ${TAG}`]);
      if (tr.length > 0) trunkId = tr[0].id;
      else {
        const r = await q(
          "INSERT INTO trunks (name, supplier_id, capacity, is_active) VALUES ($1, $2, 100, true) RETURNING id",
          [`XConn Link Trunk ${TAG}`, linkSuppId]
        );
        trunkId = r.rows[0].id;
      }
    }
    let routeId: number;
    {
      const { rows: rr } = await pool.query("SELECT id FROM routes WHERE name = $1", [`XConn Link Route ${TAG}`]);
      if (rr.length > 0) routeId = rr[0].id;
      else {
        const r = await q(
          "INSERT INTO routes (name, trunk_id, priority, is_active) VALUES ($1, $2, 1, true) RETURNING id",
          [`XConn Link Route ${TAG}`, trunkId]
        );
        routeId = r.rows[0].id;
      }
    }
    await q("INSERT INTO route_plan_routes (route_plan_id, route_id, priority) VALUES ($1, $2, 1) ON CONFLICT DO NOTHING", [planId, routeId]);
    await q("UPDATE clients SET route_plan_id = $1 WHERE id = $2", [planId, outClientId]);
  }

  // ── Routing: inbound client plan → gateway supplier ──
  {
    const { rows } = await pool.query("SELECT id FROM route_plans WHERE name = $1", [`XConn In Plan ${TAG}`]);
    let planId: number;
    if (rows.length > 0) planId = rows[0].id;
    else {
      const r = await q("INSERT INTO route_plans (name, is_active) VALUES ($1, true) RETURNING id", [`XConn In Plan ${TAG}`]);
      planId = r.rows[0].id;
    }
    let trunkId: number;
    {
      const { rows: tr } = await pool.query("SELECT id FROM trunks WHERE name = $1", [`XConn GW Trunk ${TAG}`]);
      if (tr.length > 0) trunkId = tr[0].id;
      else {
        const r = await q(
          "INSERT INTO trunks (name, supplier_id, capacity, is_active) VALUES ($1, $2, 100, true) RETURNING id",
          [`XConn GW Trunk ${TAG}`, gwSuppId]
        );
        trunkId = r.rows[0].id;
      }
    }
    let routeId: number;
    {
      const { rows: rr } = await pool.query("SELECT id FROM routes WHERE name = $1", [`XConn GW Route ${TAG}`]);
      if (rr.length > 0) routeId = rr[0].id;
      else {
        const r = await q(
          "INSERT INTO routes (name, trunk_id, priority, is_active) VALUES ($1, $2, 1, true) RETURNING id",
          [`XConn GW Route ${TAG}`, trunkId]
        );
        routeId = r.rows[0].id;
      }
    }
    await q("INSERT INTO route_plan_routes (route_plan_id, route_id, priority) VALUES ($1, $2, 1) ON CONFLICT DO NOTHING", [planId, routeId]);
    await q("UPDATE clients SET route_plan_id = $1 WHERE id = $2", [planId, inClientId]);
  }

  await pool.query(`SET search_path TO public`);

  console.log(JSON.stringify({
    ok: true, tag: TAG, tenantId, tenantSchema: schema,
    outClient: `itest_${TAG}`, inClient: `itest_in_${TAG}`,
    linkSupplier: { id: linkSuppId, host: NEXT_IP, bindsAs: `itest_in_${NEXT_TAG}` },
    gwSupplier: { id: gwSuppId, username: `itest_gw_${TAG}` },
  }));
  await pool.end();
  process.exit(0);
}

main().catch((e) => { console.error("SETUP_ERR", e.message); process.exit(1); });
