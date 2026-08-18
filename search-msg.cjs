const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL });
const MSG = process.env.MSG || "";
const HOST = process.env.SHOST || "";

(async () => {
  try {
    const t = await p.query("SELECT id, schema_name FROM tenants ORDER BY id");
    for (const tn of t.rows) {
      try {
        await p.query("SET search_path TO " + JSON.stringify(tn.schema_name));
        if (MSG) {
          const m = await p.query(
            "SELECT message_id, client_id, sender, destination, status, dlr_status, route_id, trunk_id, supplier_id, connection_type, supplier_message_id, created_at FROM messages WHERE message_id = $1",
            [MSG]
          );
          if (m.rows.length) {
            console.log("MSG FOUND tenant", tn.id, tn.schema_name);
            console.log(JSON.stringify(m.rows, null, 1));
          }
        }
        if (HOST) {
          const s = await p.query(
            "SELECT id, name, connection_mode, connection_type, host, port, username, system_id, bind_status, is_active FROM suppliers WHERE host ILIKE $1",
            ["%" + HOST + "%"]
          );
          if (s.rows.length) {
            console.log("SUPPLIER FOUND tenant", tn.id, tn.schema_name);
            s.rows.forEach((r) => console.log("  sup#" + r.id, r.name, "|", r.host + ":" + r.port, "|", r.connection_mode, "|", r.bind_status, "|", r.is_active));
          }
        }
      } catch (e) { /* skip incompatible schema */ }
    }
    await p.query("SET search_path TO public");
  } catch (e) {
    console.log("ERR", e.message);
  }
  await p.end();
})();
