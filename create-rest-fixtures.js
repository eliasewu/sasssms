require("dotenv").config({ path: "/home/ubuntu/saas-sms-platform-architecture/.env" });
const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL });
const schema = "tenant_net2app_test_1782920018891";

(async () => {
  await p.query(`SET search_path TO "${schema}"`);

  // Clean up any leftovers from a previous run of this test
  await p.query(`DELETE FROM routes WHERE name = 'REST Sim Route'`);
  await p.query(`DELETE FROM trunks WHERE name = 'REST Sim Trunk'`);
  await p.query(`DELETE FROM suppliers WHERE username = 'restgw_test'`);
  await p.query(`DELETE FROM messages WHERE message_id LIKE 'MSG_RESTE2E%'`);

  const sup = await p.query(
    `INSERT INTO suppliers (supplier_code, name, company_name, connection_type, connection_mode,
       host, port, username, password, system_type, bind_type, is_active, bind_status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,'UNBOUND') RETURNING id`,
    ["RESTGW01", "REST Sim Gateway", "Net2APP Test", "ANDROID_SMS", "SERVER",
      null, null, "restgw_test", "restgw_pass123", "ANDROID_SMS", "TRX"]
  );
  const supplierId = sup.rows[0].id;

  const trunk = await p.query(
    `INSERT INTO trunks (name, supplier_id, is_active) VALUES ($1,$2,true) RETURNING id`,
    ["REST Sim Trunk", supplierId]
  );
  const trunkId = trunk.rows[0].id;

  const route = await p.query(
    `INSERT INTO routes (name, trunk_id, priority, is_active) VALUES ($1,$2,1,true) RETURNING id`,
    ["REST Sim Route", trunkId]
  );
  const routeId = route.rows[0].id;

  console.log(JSON.stringify({ supplierId, trunkId, routeId }));
  await p.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
