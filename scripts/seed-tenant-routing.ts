/**
 * seed-tenant-routing.ts
 *
 * Seeds default routing infrastructure for ALL active tenants:
 * 1. Creates a default route plan if none exist
 * 2. Creates a default trunk + route if none exist
 * 3. Links routes to plans via route_plan_routes
 * 4. Ensures at least one active supplier exists
 *
 * This fixes "No active routes in plan" errors when testing SMS.
 *
 * Run: npx tsx scripts/seed-tenant-routing.ts
 */
const { pool } = require("../src/db/index");

async function main() {
  const c = await pool.connect();
  try {
    const { rows: tenants } = await c.query(
      "SELECT id, schema_name, company_name FROM tenants WHERE is_active = true ORDER BY id"
    );

    let createdPlans = 0;
    let createdTrunks = 0;
    let createdRoutes = 0;
    let linkedRoutes = 0;

    for (const t of tenants) {
      try {
        await c.query(`SET search_path TO "${t.schema_name}"`);

        // ── Step 1: Check existing routes, trunks, plans ──
        let planCount = 0;
        let routeCount = 0;
        let trunkCount = 0;
        let supplierCount = 0;
        try { planCount = parseInt((await c.query("SELECT COUNT(*) as c FROM route_plans")).rows[0]?.c || "0"); } catch {}
        try { routeCount = parseInt((await c.query("SELECT COUNT(*) as c FROM routes")).rows[0]?.c || "0"); } catch {}
        try { trunkCount = parseInt((await c.query("SELECT COUNT(*) as c FROM trunks")).rows[0]?.c || "0"); } catch {}
        try { supplierCount = parseInt((await c.query("SELECT COUNT(*) as c FROM suppliers WHERE is_active = true")).rows[0]?.c || "0"); } catch {}

        // ── Step 2: Create a default active supplier if none exist ──
        let supplierId: number | null = null;
        if (supplierCount === 0) {
          const result = await c.query(
            `INSERT INTO suppliers (name, connection_type, connection_mode, bind_status, is_active)
             VALUES ('Default HTTP Supplier', 'HTTP API', 'CLIENT', 'UNBOUND', true) RETURNING id`
          );
          supplierId = result.rows[0].id;
          console.log(`  ${t.schema_name}: Created default supplier #${supplierId}`);
        } else {
          const { rows: sp } = await c.query("SELECT id FROM suppliers WHERE is_active = true LIMIT 1");
          if (sp.length > 0) supplierId = sp[0].id;
        }

        // ── Step 3: Create a default trunk if none exist ──
        let trunkId: number | null = null;
        const { rows: existingTrunks } = await c.query("SELECT id FROM trunks LIMIT 1");
        if (existingTrunks.length > 0) {
          trunkId = existingTrunks[0].id;
        } else if (supplierId) {
          const result = await c.query(
            `INSERT INTO trunks (name, supplier_id, capacity, is_active)
             VALUES ('Default Trunk', $1, 100, true) RETURNING id`,
            [supplierId]
          );
          trunkId = result.rows[0].id;
          createdTrunks++;
          console.log(`  ${t.schemaName}: Created default trunk #${trunkId}`);
        }

        // ── Step 4: Create a default route if none exist ──
        let routeId: number | null = null;
        const { rows: existingRoutes } = await c.query("SELECT id FROM routes LIMIT 1");
        if (existingRoutes.length > 0) {
          routeId = existingRoutes[0].id;
        } else if (trunkId) {
          const result = await c.query(
            `INSERT INTO routes (name, trunk_id, priority, is_active)
             VALUES ('Default Route', $1, 1, true) RETURNING id`,
            [trunkId]
          );
          routeId = result.rows[0].id;
          createdRoutes++;
          console.log(`  ${t.schemaName}: Created default route #${routeId}`);
        }

        // ── Step 5: Create a default route plan if none exist ──
        let planId: number | null = null;
        const { rows: existingPlans } = await c.query("SELECT id FROM route_plans LIMIT 1");
        if (existingPlans.length > 0) {
          planId = existingPlans[0].id;
        } else {
          const result = await c.query(
            `INSERT INTO route_plans (name, is_active) VALUES ('Default Plan', true) RETURNING id`
          );
          planId = result.rows[0].id;
          createdPlans++;
          console.log(`  ${t.schemaName}: Created default route plan #${planId}`);
        }

        // ── Step 6: Link route to plan if not already linked ──
        if (routeId && planId) {
          const { rows: existingLinks } = await c.query(
            "SELECT id FROM route_plan_routes WHERE route_plan_id = $1 AND route_id = $2",
            [planId, routeId]
          );
          if (existingLinks.length === 0) {
            await c.query(
              "INSERT INTO route_plan_routes (route_plan_id, route_id, priority) VALUES ($1, $2, 1)",
              [planId, routeId]
            );
            linkedRoutes++;
            console.log(`  ${t.schemaName}: Linked route #${routeId} → plan #${planId}`);
          }
        }

        // ── Step 7: Assign default plan to any active client with no plan ──
        if (planId) {
          const result = await c.query(
            "UPDATE clients SET route_plan_id = $1, updated_at = NOW() WHERE route_plan_id IS NULL AND is_active = true",
            [planId]
          );
          if (result.rowCount && result.rowCount > 0) {
            console.log(`  ${t.schemaName}: Assigned plan #${planId} to ${result.rowCount} clients`);
          }
        }

        console.log(`  ${t.companyName || t.schemaName}: ${planCount}→${planCount || 1} plans, ${routeCount}→${routeCount || 1} routes, ${trunkCount}→${trunkCount || 1} trunks`);
      } catch (err) {
        console.warn(`  ⚠️ Skipping ${t.schemaName}: ${(err as Error).message}`);
      }
    }

    await c.query("SET search_path TO public");
    console.log(`\nDone! Created: ${createdPlans} plans, ${createdTrunks} trunks, ${createdRoutes} routes, linked ${linkedRoutes} routes`);
  } finally {
    c.release();
    process.exit(0);
  }
}

main().catch((err) => { console.error("Seed failed:", err); process.exit(1); });
