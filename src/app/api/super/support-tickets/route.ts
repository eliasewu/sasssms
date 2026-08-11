import { NextResponse } from "next/server";
import { getSuperAdminFromRequest } from "@/lib/auth";
import { pool } from "@/db";
import { ALL_SERVER_IPS, serverLabel, getSelfIp } from "@/lib/server-ips";
import { fetchWithTimeout } from "@/lib/fetch-timeout";

async function getAdminName(adminId: number): Promise<string> {
  const r = await pool.query("SELECT name FROM super_admins WHERE id = $1", [adminId]);
  return r.rows[0]?.name || "Admin";
}

// Rate-limited error logging: log once per minute per server
const lastErrorLog: Record<string, number> = {};
function logErrorOnce(ip: string, msg: string) {
  const now = Date.now();
  if (!lastErrorLog[ip] || now - lastErrorLog[ip] > 60000) {
    lastErrorLog[ip] = now;
    console.error(`[Tickets] Failed to fetch from ${ip}: ${msg}`);
  }
}

// Fetch tickets from a single server.
// Always appends internal=1 so the remote handler returns LOCAL tickets only —
// without this, every remote request re-triggers aggregation to all siblings,
// causing exponential request amplification between servers (a single page load
// balloons into tens of thousands of requests).
async function fetchTicketsFromServer(
  baseUrl: string,
  bearerToken: string,
  queryString: string
): Promise<{ tickets: unknown[]; error?: string }> {
  try {
    const sep = queryString ? "&" : "?";
    const url = `${baseUrl}/api/super/support-tickets${queryString}${sep}internal=1`;
    const res = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    }, 3000);

    if (!res.ok) return { tickets: [], error: `HTTP ${res.status}` };
    const data = await res.json();
    const tagged = (data.tickets || []).map((t: Record<string, unknown>) => ({
      ...t,
      server: serverLabel(new URL(baseUrl).hostname),
      _serverIp: new URL(baseUrl).hostname,
    }));
    return { tickets: tagged };
  } catch (e: unknown) {
    const ip = new URL(baseUrl).hostname;
    logErrorOnce(ip, (e as Error).message);
    return { tickets: [], error: (e as Error).message };
  }
}

// GET /api/super/support-tickets — list all tickets across all tenants AND all servers
export async function GET(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const authHdr = request.headers.get("authorization");
  const cookie = request.headers.get("cookie") || "";
  const tokenMatch = cookie.match(/super_admin_token=([^;]+)/);
  const bearerToken = authHdr?.replace(/^Bearer\s+/i, "") || (tokenMatch ? tokenMatch[1] : "");

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const tenantId = url.searchParams.get("tenantId");
  const isInternal = url.searchParams.get("internal") === "1";

  const queryString = status ? `?status=${status}` : tenantId ? `?tenantId=${tenantId}` : "";

  // 1. Detect self IP and fetch local tickets
  const selfIp = await getSelfIp();
  const localLabel = serverLabel(selfIp);

  let query = `
    SELECT t.*, tn.company_name as tenant_name, tn.email as tenant_email,
      (SELECT COUNT(*) FROM support_ticket_replies r WHERE r.ticket_id = t.id) as reply_count
    FROM support_tickets t
    JOIN tenants tn ON t.tenant_id = tn.id
  `;
  const params: (string | number)[] = [];
  const conditions: string[] = [];

  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (tenantId) {
    params.push(parseInt(tenantId));
    conditions.push(`t.tenant_id = $${params.length}`);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }
  query += " ORDER BY t.updated_at DESC";

  const result = await pool.query(query, params);
  const localTickets = result.rows.map((t) => ({ ...t, server: localLabel, _serverIp: selfIp }));

  // Internal aggregation hop (called by another server's support-tickets route):
  // return LOCAL tickets only. Never recurse — this is what prevents the
  // cross-server request amplification loop.
  if (isInternal) {
    return NextResponse.json({ tickets: localTickets });
  }

  // 2. Fetch from all remote servers in parallel (with 3s hard timeout each)
  const remoteIps = ALL_SERVER_IPS.filter((ip: string) => ip !== selfIp && ip !== "127.0.0.1");
  const remotePromises = remoteIps.map((ip) =>
    fetchTicketsFromServer(`http://${ip}:5556`, bearerToken, queryString)
  );

  const remoteResults = await Promise.all(remotePromises);

  // Collect warnings (errors are rate-limited logged inside fetchTicketsFromServer)
  const errors: string[] = [];
  remoteResults.forEach((r, i) => {
    if (r.error) {
      errors.push(`${serverLabel(remoteIps[i])}: ${r.error}`);
    }
  });

  // 3. Merge all tickets
  const allTickets = [
    ...localTickets,
    ...remoteResults.flatMap((r) => r.tickets),
  ];

  allTickets.sort(
    (a, b) =>
      new Date(b.updated_at as string).getTime() -
      new Date(a.updated_at as string).getTime()
  );

  return NextResponse.json({
    tickets: allTickets,
    ...(errors.length > 0 && { warnings: errors }),
  });
}

// PATCH /api/super/support-tickets — update ticket status (supports cross-server via ?_serverIp)
export async function PATCH(request: Request) {
  const admin = getSuperAdminFromRequest(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const serverIp = url.searchParams.get("_serverIp");

  if (serverIp) {
    const authHdr = request.headers.get("authorization");
    const cookie = request.headers.get("cookie") || "";
    const tokenMatch = cookie.match(/super_admin_token=([^;]+)/);
    const bearerToken = authHdr?.replace(/^Bearer\s+/i, "") || (tokenMatch ? tokenMatch[1] : "");
    const body = await request.text();
    try {
      const res = await fetchWithTimeout(
        `http://${serverIp}:5556/api/super/support-tickets`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${bearerToken}`,
          },
          body,
        },
        3000
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return NextResponse.json(errData, { status: res.status });
      }
      const data = await res.json();
      return NextResponse.json(data);
    } catch (e: unknown) {
      return NextResponse.json({ error: `Could not reach server: ${(e as Error).message}` }, { status: 502 });
    }
  }
  const jsonBody = await request.json();
  const { ticketId, status } = jsonBody;

  if (!ticketId || !status) {
    return NextResponse.json({ error: "ticketId and status are required" }, { status: 400 });
  }

  const validStatuses = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` }, { status: 400 });
  }

  const result = await pool.query(
    `UPDATE support_tickets SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, ticketId]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const adminName = await getAdminName(admin.adminId);
  await pool.query(
    `INSERT INTO support_ticket_replies (ticket_id, replied_by, replied_by_id, replied_by_name, message)
     VALUES ($1, 'super', $2, $3, $4)`,
    [ticketId, admin.adminId, adminName, `📌 Status changed to ${status} by ${adminName}`]
  );

  return NextResponse.json({ ticket: result.rows[0] });
}
