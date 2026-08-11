/**
 * Audit: find columns/tables that were added to createTenantSchema AFTER existing
 * tenants were created (they never get the new columns because CREATE TABLE
 * IF NOT EXISTS no-ops on existing tables). Compares the current source-of-truth
 * (TENANT_TABLE_DEFS) against the live schemas on every production server.
 *
 * Usage: npx tsx scripts/check-tenant-column-deltas.ts
 */
import { execSync } from "child_process";
import { TENANT_TABLE_DEFS, extractColumnDefs } from "../src/lib/tenant-schema";

const SERVERS = [
  { name: "ORIGIN", ip: "149.56.22.232" },
  { name: "FRANCE", ip: "54.37.252.5" },
  { name: "GERMANY", ip: "145.239.1.7" },
  { name: "SYDNEY", ip: "139.99.148.65" },
];

// Expected columns per table (from current code — the source of truth)
const expectedMap = extractColumnDefs(TENANT_TABLE_DEFS);
const expectedCols: Record<string, Set<string>> = {};
for (const [table, defs] of Object.entries(expectedMap)) {
  expectedCols[table] = new Set(defs.map((d) => d.split(/\s+/)[0]));
}

const EXPECTED_TABLES = new Set(Object.keys(expectedCols));

function queryServer(server: { name: string; ip: string }) {
  const sql = `SELECT table_schema, table_name, column_name FROM information_schema.columns WHERE table_schema LIKE 'tenant\\_%' ORDER BY 1,2,3;`;
  const cmd = `echo "${sql}" | SSHPASS=Telco1988 sshpass -e ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ubuntu@${server.ip} 'sudo -u postgres psql -d app_db -t -A' 2>/dev/null`;
  const out = execSync(cmd, { timeout: 120000, encoding: "utf8" });
  const rows: Record<string, Set<string>> = {};
  const tables: Record<string, Set<string>> = {};
  for (const line of out.split("\n")) {
    const [schema, table, column] = line.split("|");
    if (!schema || !table || !column) continue;
    const key = `${schema}.${table}`;
    if (!rows[key]) rows[key] = new Set();
    rows[key].add(column);
    if (!tables[schema]) tables[schema] = new Set();
    tables[schema].add(table);
  }
  return { rows, tables };
}

const FOCUS_TABLES = ["messages", "clients", "routes"];

for (const server of SERVERS) {
  console.log(`\n════════ ${server.name} (${server.ip}) ════════`);
  let data;
  try {
    data = queryServer(server);
  } catch (e) {
    console.log(`  ❌ query failed: ${String(e).slice(0, 200)}`);
    continue;
  }
  const { rows, tables } = data;
  const schemas = Object.keys(tables).sort();
  console.log(`  tenant schemas: ${schemas.length}`);

  if (schemas.length === 0) {
    console.log("  (no tenant schemas on this server)");
    continue;
  }

  // Per-table summary of missing columns + missing tables
  for (const table of [...FOCUS_TABLES, ...[...EXPECTED_TABLES].sort()].filter(
    (t, i, arr) => arr.indexOf(t) === i
  )) {
    const missingCols = new Map<string, string[]>(); // column -> schemas missing it
    const missingTableSchemas: string[] = [];
    for (const schema of schemas) {
      const key = `${schema}.${table}`;
      const actual = rows[key];
      if (!actual) {
        missingTableSchemas.push(schema);
        continue;
      }
      for (const col of expectedCols[table] ?? []) {
        if (!actual.has(col)) {
          if (!missingCols.has(col)) missingCols.set(col, []);
          missingCols.get(col)!.push(schema);
        }
      }
    }
    const issues: string[] = [];
    if (missingTableSchemas.length)
      issues.push(
        `MISSING TABLE in ${missingTableSchemas.length}/${schemas.length} schemas`
      );
    for (const [col, affected] of missingCols) {
      issues.push(
        `missing '${col}' in ${affected.length}/${schemas.length} schemas`
      );
    }
    if (issues.length) {
      console.log(`  ▸ ${table}: ${issues.join("; ")}`);
    }
  }

  // Detail for the focus tables
  for (const table of FOCUS_TABLES) {
    const missingCols = new Map<string, string[]>();
    const missingTableSchemas: string[] = [];
    for (const schema of schemas) {
      const actual = rows[`${schema}.${table}`];
      if (!actual) {
        missingTableSchemas.push(schema);
        continue;
      }
      for (const col of expectedCols[table] ?? []) {
        if (!actual.has(col)) {
          if (!missingCols.has(col)) missingCols.set(col, []);
          missingCols.get(col)!.push(schema);
        }
      }
    }
    if (missingTableSchemas.length)
      console.log(`\n  DETAIL ${table}: table absent in:`);
    for (const s of missingTableSchemas.slice(0, 8))
      console.log(`    - ${s}`);
    for (const [col, affected] of missingCols) {
      console.log(`\n  DETAIL ${table}: '${col}' missing in ${affected.length} schemas:`);
      for (const s of affected.slice(0, 12)) console.log(`    - ${s}`);
    }
  }
}
console.log("\n════════ DONE ════════");
