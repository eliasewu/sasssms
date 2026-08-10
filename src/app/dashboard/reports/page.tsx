import { cookies, headers } from "next/headers";
import ReportFilters from "./filters";

interface VolumePoint {
  period: string;
  count: string;
  revenue: string;
  cost: string;
  profit: string;
}
interface ClientSummary {
  client_id: number;
  client_name: string;
  count: number;
  revenue: number;
  cost: number;
  profit: number;
}
interface SupplierSummary {
  supplier_id: number;
  supplier_name: string;
  count: number;
  cost: number;
}
interface DlrSummary {
  dlr_status: string;
  count: number;
}

// Colors per DLR status so the delivery chart is scannable at a glance.
const DLR_COLORS: Record<string, string> = {
  DELIVERED: "bg-emerald-500",
  FAILED: "bg-red-500",
  UNDELIV: "bg-rose-400",
  REJECTED: "bg-orange-500",
  EXPIRED: "bg-amber-500",
  PENDING: "bg-slate-300",
  ENROUTE: "bg-sky-400",
  SENT: "bg-indigo-400",
  UNKNOWN: "bg-slate-400",
};
const DLR_DEFAULT_COLOR = "bg-slate-400";

async function getReportData(
  type: string,
  startDate: string,
  endDate: string,
  connectionType: string
): Promise<{
  volume: VolumePoint[];
  byClient: ClientSummary[];
  bySupplier: SupplierSummary[];
  byConnectionType: { connection_type: string; count: number }[];
  dlrSummary: DlrSummary[];
}> {
  const cookieStore = await cookies();
  const heads = await headers();
  const host = heads.get("host") || "localhost:3000";
  const protocol =
    heads.get("x-forwarded-proto") ||
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const baseUrl = `${protocol}://${host}`;
  const params = new URLSearchParams({ type, startDate, endDate });
  if (connectionType) params.set("connectionType", connectionType);
  const res = await fetch(`${baseUrl}/api/tenant/reports?${params}`, {
    headers: { Cookie: cookieStore.toString() },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Reports API error: ${res.status}`);
  return res.json();
}

function isValidDate(d: string): boolean {
  return !isNaN(new Date(d).getTime());
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: {
    type?: string;
    startDate?: string;
    endDate?: string;
    connectionType?: string;
  };
}) {
  const type = searchParams.type || "daily";
  const connectionType = searchParams.connectionType || "";
  const startRaw =
    searchParams.startDate &&
    isValidDate(searchParams.startDate)
      ? searchParams.startDate
      : new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const endRaw =
    searchParams.endDate && isValidDate(searchParams.endDate)
      ? searchParams.endDate
      : new Date().toISOString().slice(0, 10);

  const startIso = new Date(startRaw).toISOString();
  const endIso = new Date(endRaw + "T23:59:59.999Z").toISOString();

  const data = await getReportData(type, startIso, endIso, connectionType);

  const v = (data.volume as VolumePoint[]) || [];
  const totalMsgs = v.reduce((s, x) => s + parseInt(x.count || "0"), 0);
  const totalRev = v.reduce((s, x) => s + parseFloat(x.revenue || "0"), 0);
  const totalCost = v.reduce((s, x) => s + parseFloat(x.cost || "0"), 0);
  const totalProfit = v.reduce((s, x) => s + parseFloat(x.profit || "0"), 0);
  const maxVol = Math.max(...v.map((x) => parseInt(x.count || "0")), 1);
  const byClient = (data.byClient as ClientSummary[]) || [];
  const bySupplier = (data.bySupplier as SupplierSummary[]) || [];
  const dlrSummary = (data.dlrSummary as DlrSummary[]) || [];
  const byConnectionType = (data.byConnectionType as {
    connection_type: string;
    count: number;
  }[]) || [];
  const deliveredCount = dlrSummary
    .filter((d) => d.dlr_status === "DELIVERED")
    .reduce((s, d) => s + d.count, 0);
  // REJECTED is excluded here: those rows were never sent (gate rejection),
  // so they're not delivery failures — including them would deflate the rate.
  const failedCount = dlrSummary
    .filter((d) => ["FAILED", "UNDELIV", "EXPIRED"].includes(d.dlr_status))
    .reduce((s, d) => s + d.count, 0);
  const deliveryRate =
    deliveredCount + failedCount > 0
      ? (deliveredCount / (deliveredCount + failedCount)) * 100
      : null;
  const maxDlr = Math.max(...dlrSummary.map((x) => x.count), 1);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Reports &amp; Analytics
          </h2>
          <p className="text-sm text-slate-500">
            SMS traffic, revenue, cost, and profit reporting
          </p>
        </div>
        <ReportFilters
          defaultType={type}
          defaultStart={startRaw}
          defaultEnd={endRaw}
          defaultConnectionType={connectionType}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-slate-500">Total Messages</p>
          <p className="text-2xl font-bold">{totalMsgs.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-slate-500">Revenue</p>
          <p className="text-2xl font-bold text-blue-600">
            ${totalRev.toFixed(4)}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-slate-500">Cost</p>
          <p className="text-2xl font-bold text-amber-600">
            ${totalCost.toFixed(4)}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-slate-500">Profit</p>
          <p
            className={`text-2xl font-bold ${
              totalProfit >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            ${totalProfit.toFixed(4)}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-slate-500">Active Clients</p>
          <p className="text-2xl font-bold text-indigo-600">
            {byClient.length}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-slate-500">Suppliers</p>
          <p className="text-2xl font-bold text-purple-600">
            {bySupplier.length}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-slate-500">Avg Revenue/SMS</p>
          <p className="text-2xl font-bold text-blue-500">
            ${totalMsgs > 0 ? (totalRev / totalMsgs).toFixed(6) : "0"}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-slate-500">Profit Margin</p>
          <p
            className={`text-2xl font-bold ${
              totalProfit >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            {totalRev > 0 ? ((totalProfit / totalRev) * 100).toFixed(1) : "0"}
            %
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-slate-500">
            {connectionType ? `Delivery Rate (${connectionType})` : "Delivery Rate"}
          </p>
          <p
            className={`text-2xl font-bold ${
              deliveryRate === null
                ? "text-slate-400"
                : deliveryRate >= 80
                  ? "text-emerald-600"
                  : deliveryRate >= 50
                    ? "text-amber-600"
                    : "text-red-600"
            }`}
          >
            {deliveryRate === null ? "—" : `${deliveryRate.toFixed(1)}%`}
          </p>
        </div>
      </div>

      {/* Volume Chart */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">Volume ({type})</h3>
        <div className="flex items-end gap-1 h-40 overflow-x-auto">
          {v.map((x, i) => {
            const h = (parseInt(x.count || "0") / maxVol) * 100;
            return (
              <div
                key={i}
                className="flex flex-col items-center min-w-[20px] flex-1 group relative"
              >
                <div className="absolute -top-6 bg-slate-800 text-white text-xs px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                  {x.count} msgs
                </div>
                <div
                  className="w-full bg-blue-500 rounded-t"
                  style={{ height: `${Math.max(h, 1)}%` }}
                />
                <span className="text-[9px] text-slate-400 -bottom-5 absolute">
                  {new Date(x.period).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* DLR Delivery Stats — charted per status; scope with the connection
          type filter to chart Business API (or any channel) delivery. */}
      {dlrSummary.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold mb-1">
            Delivery Stats
            {connectionType && (
              <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">
                {connectionType}
              </span>
            )}
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Messages by DLR result{" "}
            {connectionType
              ? `delivered via ${connectionType}`
              : "across all connection types"}{" "}
            in the selected period
          </p>
          <div className="space-y-2">
            {dlrSummary.map((d, i) => {
              const color =
                DLR_COLORS[d.dlr_status?.toUpperCase() || ""] ||
                DLR_DEFAULT_COLOR;
              const pct =
                deliveredCount + failedCount > 0 &&
                ["DELIVERED", "FAILED", "UNDELIV", "EXPIRED"].includes(
                  d.dlr_status
                )
                  ? ((d.count / (deliveredCount + failedCount)) * 100).toFixed(1)
                  : null;
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 font-medium text-slate-600">
                    {d.dlr_status || "unknown"}
                  </span>
                  <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                    <div
                      className={`h-full ${color} transition-all`}
                      style={{ width: `${(d.count / maxDlr) * 100}%` }}
                      title={`${d.count} messages`}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right font-mono text-slate-600">
                    {d.count.toLocaleString()}
                  </span>
                  <span className="w-14 shrink-0 text-right text-xs text-slate-400">
                    {pct === null ? "" : `${pct}%`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Revenue vs Cost vs Profit Chart */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">
          Revenue / Cost / Profit ({type})
        </h3>
        <div className="grid grid-cols-3 gap-2 text-center text-xs mb-2">
          <span className="text-blue-600 font-medium">■ Revenue</span>
          <span className="text-amber-600 font-medium">■ Cost</span>
          <span className="text-green-600 font-medium">■ Profit</span>
        </div>
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {v.map((x, i) => {
            const rev = parseFloat(x.revenue || "0");
            const cost = parseFloat(x.cost || "0");
            const profit = parseFloat(x.profit || "0");
            const maxBar = Math.max(rev, cost, 0.00001);
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-16 text-slate-400 text-right">
                  {new Date(x.period).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <div className="flex-1 flex gap-0.5 h-4">
                  <div
                    className="bg-blue-500 rounded"
                    style={{ width: `${(rev / maxBar) * 100}%` }}
                    title={`Revenue: $${rev.toFixed(6)}`}
                  />
                  <div
                    className="bg-amber-500 rounded"
                    style={{ width: `${(cost / maxBar) * 100}%` }}
                    title={`Cost: $${cost.toFixed(6)}`}
                  />
                  <div
                    className="bg-green-500 rounded"
                    style={{
                      width: `${Math.max(0, profit / maxBar) * 100}%`,
                    }}
                    title={`Profit: $${profit.toFixed(6)}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Connection Type Breakdown — hidden when scoped to one type */}
      {!connectionType && byConnectionType.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold mb-4">By Connection Type</h3>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-right px-4 py-2">Messages</th>
                <th className="text-right px-4 py-2">Share</th>
              </tr>
            </thead>
            <tbody>
              {byConnectionType.map((t, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2 font-medium">
                    {t.connection_type || "Unset"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {t.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-500">
                    {totalMsgs > 0
                      ? `${((t.count / totalMsgs) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Client Breakdown */}
      {byClient.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold mb-4">By Client</h3>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2">Client</th>
                <th className="text-right px-4 py-2">Messages</th>
                <th className="text-right px-4 py-2">Revenue</th>
                <th className="text-right px-4 py-2">Cost</th>
                <th className="text-right px-4 py-2">Profit</th>
              </tr>
            </thead>
            <tbody>
              {byClient.map((c, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2 font-medium">
                    {c.client_name || `#${c.client_id}`}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {c.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-blue-600">
                    ${(c.revenue || 0).toFixed(4)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-amber-600">
                    ${(c.cost || 0).toFixed(4)}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-mono font-bold ${
                      (c.profit || 0) >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    ${(c.profit || 0).toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Supplier Breakdown */}
      {bySupplier.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold mb-4">By Supplier</h3>
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2">Supplier</th>
                <th className="text-right px-4 py-2">Messages</th>
                <th className="text-right px-4 py-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {bySupplier.map((s, i) => (
                <tr key={i} className="border-t">
                  <td className="px-4 py-2 font-medium">
                    {s.supplier_name || `#${s.supplier_id}`}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {s.count.toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-amber-600">
                    ${(s.cost || 0).toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
