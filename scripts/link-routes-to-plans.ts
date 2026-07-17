const { pool } = require("../src/db/index");

async function main() {
  const c = await pool.connect();
  try {
    const { rows: tenants } = await c.query(
      "SELECT id, schema_name FROM tenants WHERE is_active = true ORDER BY id"
    );

    for (const t of tenants) {
      try {
        await c.query(`SET search_path TO "${t.schema_name}"`);

        // Get first active route
        const routes = await c.query("SELECT id FROM routes WHERE is_active = true LIMIT 1");
        if (!routes.rows.length) { continue; }
        const routeId = routes.rows[0].id as number;

        // Get all plans
        const plans = await c.query("SELECT id FROM route_plans");

        for (const p of plans.rows) {
          const pid = p.id as number;
          const existing = await c.query(
            "SELECT id FROM route_plan_routes WHERE route_plan_id = $1 AND route_id = $2",
            [pid, routeId]
          );
          if (existing.rows.length === 0) {
            await c.query(
              "INSERT INTO route_plan_routes (route_plan_id, route_id, priority) VALUES ($1, $2, 1)",
              [pid, routeId]
            );
            console.log(`${t.schema_name}: linked route ${routeId} → plan ${pid}`);
          }
        }
      } catch (e) { /* skip broken schemas */ }
    }

    await c.query("SET search_path TO public");
    console.log("\nDone linking routes to all plans.");
  } finally {
    c.release();
    process.exit(0);
  }
}

main().catch((err: Error) => { console.error(err); process.exit(1); });
