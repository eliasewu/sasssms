require("dotenv").config({ path: "/home/ubuntu/saas-sms-platform-architecture/.env" });
const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL });

async function q(schema, text, params = []) {
  const r = await p.query(`SELECT * FROM "${schema}".${text}`, params);
  return r.rows;
}

(async () => {
  const schema = "tenant_net2app_test_1782920018891";
  console.log("=== SUPPLIERS (test tenant) ===");
  const sups = await q(schema, "suppliers ORDER BY id");
  for (const s of sups) {
    console.log(JSON.stringify({
      id: s.id, name: s.name, username: s.username, password: s.password ? "***" : null,
      connection_type: s.connection_type, connection_mode: s.connection_mode,
      bind_status: s.bind_status, is_active: s.is_active, system_type: s.system_type,
      host: s.host, port: s.port, deleted_at: s.deleted_at,
    }));
  }
  console.log("=== TRUNKS ===");
  const trunks = await q(schema, "trunks ORDER BY id");
  for (const t of trunks) {
    console.log(JSON.stringify({ id: t.id, name: t.name, supplier_id: t.supplier_id, is_active: t.is_active }));
  }
  console.log("=== ROUTES ===");
  const routes = await q(schema, "routes ORDER BY id");
  for (const r of routes) {
    console.log(JSON.stringify({ id: r.id, name: r.name, trunk_id: r.trunk_id, country_code: r.country_code, prefix: r.prefix, is_active: r.is_active }));
  }
  console.log("=== ROUTE PLANS + LINKS ===");
  const plans = await q(schema, "route_plans ORDER BY id");
  for (const rp of plans) {
    console.log(JSON.stringify({ id: rp.id, name: rp.name, is_active: rp.is_active }));
  }
  try {
    const links = await q(schema, "route_plan_routes ORDER BY route_plan_id, priority");
    for (const l of links) {
      console.log(JSON.stringify({ route_plan_id: l.route_plan_id, route_id: l.route_id, priority: l.priority }));
    }
  } catch (e) { console.log("route_plan_routes:", e.message); }
  console.log("=== CLIENTS (first 5) ===");
  const clients = await q(schema, "clients ORDER BY id LIMIT 5");
  for (const c of clients) {
    console.log(JSON.stringify({ id: c.id, name: c.name, route_plan_id: c.route_plan_id, http_api_key: c.http_api_key, smpp_username: c.smpp_username, enable_http_api: c.enable_http_api, is_active: c.is_active, charging_mode: c.charging_mode, max_tps: c.max_tps }));
  }
  console.log("=== ANDROID GATEWAY DEVICES ===");
  try {
    const devs = await p.query(`SELECT * FROM android_gateway_devices WHERE tenant_id = 30 LIMIT 5`);
    for (const d of devs.rows) console.log(JSON.stringify(d));
  } catch (e) { console.log(e.message); }
  await p.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
