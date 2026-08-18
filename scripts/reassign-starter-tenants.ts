/**
 * Reassign starter tenants to starter servers.
 *
 * Uses the SAME region + least-loaded logic as new signups
 * (pickServerForPackage / countryCodeFromPhone from src/lib/server-assignment.ts)
 * so that every starter tenant ends up on a region-appropriate `starter` server.
 *
 * Tenants already on a starter server are left untouched (no churn).
 * Tenants on professional/dev/unassigned boxes are moved to a starter server.
 *
 * Usage (run from the project root on the target host):
 *   npx tsx scripts/reassign-starter-tenants.ts            # dry run
 *   npx tsx scripts/reassign-starter-tenants.ts --apply    # write changes
 */
import { Client } from "pg";
import {
  pickServerForPackage,
  countryCodeFromPhone,
  type ServerLocation,
} from "../src/lib/server-assignment";

const APPLY = process.argv.includes("--apply");

async function main() {
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5432/app_db",
  });
  await client.connect();

  // ── server locations ──
  const locRes = await client.query(
    "SELECT value FROM platform_settings WHERE key = 'server_locations'"
  );
  const locations: ServerLocation[] = JSON.parse(locRes.rows[0]?.value || "[]");

  const starterIps = new Set(
    locations
      .filter(
        (l) =>
          (l.package || "starter") === "starter" &&
          l.isActive &&
          l.ipAddress &&
          l.ipAddress !== "0.0.0.0"
      )
      .map((l) => l.ipAddress)
  );
  console.log("Starter server IPs:", [...starterIps].join(", ") || "(none)");

  // ── current tenant load per server (least-loaded tiebreak) ──
  const loadRes = await client.query(
    `SELECT smpp_server_ip, COUNT(*)::int AS c FROM tenants
     WHERE smpp_server_ip IS NOT NULL AND smpp_server_ip <> '0.0.0.0' AND is_active = true
     GROUP BY smpp_server_ip`
  );
  const loads: Record<string, number> = {};
  for (const r of loadRes.rows) loads[r.smpp_server_ip] = r.c;

  // ── starter tenants (package_type starter or legacy NULL) ──
  const tRes = await client.query(
    `SELECT id, company_name, phone, smpp_server_ip, server_location, is_active
     FROM tenants
     WHERE package_type = 'starter' OR package_type IS NULL
     ORDER BY id`
  );

  interface Plan {
    id: number;
    name: string;
    fromIp: string;
    toIp: string;
    toLoc: string;
    country: string | null;
  }
  const plans: Plan[] = [];
  const skipped: string[] = [];

  for (const t of tRes.rows) {
    const curIp = t.smpp_server_ip || "";
    if (starterIps.has(curIp)) {
      skipped.push(`#${t.id} ${t.company_name} (already on ${curIp})`);
      continue;
    }
    const country = countryCodeFromPhone(t.phone);
    const pick = pickServerForPackage(locations, {
      package: "starter",
      countryCode: country,
      loads,
    });
    if (!pick) {
      skipped.push(`#${t.id} ${t.company_name} — NO STARTER SERVER (from ${curIp || "unassigned"})`);
      continue;
    }
    if (curIp && curIp !== "0.0.0.0" && loads[curIp]) loads[curIp]--;
    loads[pick.ipAddress] = (loads[pick.ipAddress] || 0) + 1;

    plans.push({
      id: t.id,
      name: t.company_name,
      fromIp: curIp,
      toIp: pick.ipAddress,
      toLoc: pick.id,
      country,
    });
  }

  console.log(`\nStarter tenants to MOVE: ${plans.length}`);
  for (const p of plans) {
    console.log(
      `  #${p.id}  ${p.name.padEnd(32)} ${(p.fromIp || "unassigned").padEnd(15)} -> ${p.toIp}  (${p.toLoc}, cc=${p.country ?? "?"})`
    );
  }
  console.log(`\nSkipped / already placed: ${skipped.length}`);
  for (const s of skipped) console.log(`  ${s}`);

  if (!APPLY) {
    console.log("\nDRY RUN — no changes written. Re-run with --apply to apply.");
    await client.end();
    return;
  }

  // ── backup before-state ──
  await client.query(
    `DROP TABLE IF EXISTS backup_tenants_routing_20260815`
  );
  await client.query(
    `CREATE TABLE backup_tenants_routing_20260815 AS
     SELECT id, company_name, package_type, smpp_server_ip, server_location, smpp_server_port FROM tenants`
  );

  await client.query("BEGIN");
  try {
    for (const p of plans) {
      await client.query(
        `UPDATE tenants SET smpp_server_ip = $1, server_location = $2 WHERE id = $3`,
        [p.toIp, p.toLoc, p.id]
      );
    }
    await client.query("COMMIT");
    console.log(`\nAPPLIED ${plans.length} tenant reassignment(s). Backup: backup_tenants_routing_20260815`);
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
