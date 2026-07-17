const { pool } = require("../src/db/index");

async function main() {
  const c = await pool.connect();
  try {
    // Find elias@triangletrade.net tenant
    const tRes = await c.query(
      "SELECT id, schema_name, company_name FROM tenants WHERE email ILIKE $1 AND is_active = true LIMIT 1",
      ["%triangletrade%"]
    );
    if (!tRes.rows.length) { console.log("No tenant found"); process.exit(1); }
    const t = tRes.rows[0];
    console.log("Tenant:", t.company_name, "(" + t.schema_name + ")");

    await c.query(`SET search_path TO "${t.schema_name}"`);

    // List clients
    const { rows: clients } = await c.query(
      "SELECT id, name, email, route_plan_id FROM clients WHERE deleted_at IS NULL ORDER BY id"
    );
    console.log("\nClients:");
    clients.forEach(cl => console.log(`  id=${cl.id} name=${cl.name} email=${cl.email} route_plan_id=${cl.route_plan_id}`));

    // List route plans
    const { rows: plans } = await c.query(
      "SELECT id, name FROM route_plans WHERE deleted_at IS NULL AND is_active = true"
    );
    console.log("\nRoute Plans:");
    plans.forEach(p => console.log(`  id=${p.id} name=${p.name}`));

    if (clients.length > 0 && plans.length > 0) {
      // Test update on first client
      const client = clients[0];
      const targetPlanId = plans[0].id;
      console.log(`\n--- Testing update on client ${client.id} (${client.name}) ---`);
      console.log(`Before: route_plan_id = ${client.route_plan_id}`);
      console.log(`Setting: route_plan_id = ${targetPlanId} (${plans[0].name})`);

      const result = await c.query(
        `UPDATE clients SET route_plan_id = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING id, route_plan_id`,
        [targetPlanId, client.id]
      );
      console.log("UPDATE result:", JSON.stringify(result.rows[0]));

      // Verify
      const { rows: verify } = await c.query(
        "SELECT route_plan_id FROM clients WHERE id = $1",
        [client.id]
      );
      console.log("After verify: route_plan_id =", verify[0].route_plan_id);
      console.log(verify[0].route_plan_id === targetPlanId ? "✅ PERSISTED!" : "❌ FAILED!");
    }

    await c.query("SET search_path TO public");
  } finally {
    c.release();
    process.exit(0);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
