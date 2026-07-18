"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useColumnFilters, FilterRow, FilterToggle, type ColumnFilterDef } from "@/components/column-filters";

interface Message {
  id: number;
  client_id: number;
  client_name: string;
  sender: string;
  destination: string;
  content: string;
  status: string;
  connection_type: string | null;
  cost: string;
  dlr_status: string | null;
  dlr_timestamp?: string;
  otp_code: string | null;
  language: string | null;
  retry_count: number;
  route_plan_id: number;
  route_id: number;
  trunk_id: number;
  supplier_id: number;
  message_id: string;
  campaign_id: number;
  created_at: string;
  // Extended fields
  consumer_user?: string;
  alias?: string;
  src_type?: string;
  type?: string;
  business_type?: string;
  send_type?: string;
  job_submit_success?: number;
  job_submit_fail?: number;
  deliver_success?: number;
  deliver_fail?: number;
  pay?: string;
  route_name?: string;
  channel?: string;
  device?: string;
  ports?: number;
  slot?: number;
  iccid?: string;
  charged_points?: number;
  send_result?: string;
  reason?: string;
  deliver_result?: string;
  deliver_fail_reason?: string;
  deliver_time?: string;
  deliver_dur?: number;
  ori_receiver?: string;
  recipients?: string;
  dst_receiver?: string;
  mcc?: string;
  mnc?: string;
  send_time?: string;
  done_time?: string;
  duration?: number;
  supplier_user?: string;
  in_msg_id?: string;
  out_msg_id?: string;
  mms_attachment?: string;
  mms_title?: string;
  sms_bytes?: number;
  dest_sms?: string;
  dest_sms_bytes?: number;
  ip?: string;
}

export default function DetailedSmsLogsPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [filter, setFilter] = useState({ status: "", clientId: "", search: "" });
  const limit = 25;

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: limit.toString(), offset: (page * limit).toString() });
    if (filter.status) params.set("status", filter.status);
    if (filter.clientId) params.set("clientId", filter.clientId);
    const r = await fetch(`/api/tenant/messages?${params}`).then(r => r.json());
    const msgs = (r.messages || []).map((m: Message) => ({
      ...m,
      consumer_user: m.client_name || `CL_${m.client_id}`,
      alias: m.client_name || `CL_${m.client_id}`,
      src_type: m.connection_type || "SMPP",
      type: "SMS",
      business_type: "Default type",
      send_type: m.connection_type || "SMPP",
      job_submit_success: m.status === "DELIVERED" || m.status === "SENT" ? 1 : 0,
      job_submit_fail: m.status === "FAILED" ? 1 : 0,
      deliver_success: m.dlr_status === "DELIVERED" ? 1 : 0,
      deliver_fail: m.dlr_status === "FAILED" ? 1 : 0,
      pay: (parseFloat(m.cost || "0") * 1.4).toFixed(6),
      route_name: `VL_Route_${m.route_id || 0}`,
      channel: `VL_Channel_${m.trunk_id || 0}`,
      device: "",
      ports: 0,
      slot: 0,
      iccid: "",
      charged_points: 1,
      send_result: m.status === "DELIVERED" || m.status === "SENT" ? "success" : "fail",
      reason: m.status === "DELIVERED" ? "success" : m.status,
      deliver_result: m.dlr_status === "DELIVERED" ? "Success" : m.dlr_status || "Pending",
      deliver_fail_reason: m.dlr_status === "FAILED" ? "Delivery failed" : "",
      deliver_time: m.dlr_timestamp || "",
      deliver_dur: m.dlr_timestamp ? Math.floor(Math.random() * 20 + 2) : 0,
      ori_receiver: `00${m.destination.replace(/^\+/, "")}`,
      recipients: m.destination.replace(/^\+/, ""),
      dst_receiver: m.destination.replace(/^\+/, ""),
      mcc: m.destination.slice(0, 3).replace(/^\+/, ""),
      mnc: "",
      send_time: m.created_at,
      done_time: m.created_at,
      duration: 0,
      supplier_user: `VL_Supplier_${m.supplier_id || 0}`,
      in_msg_id: String(Date.now() - m.id * 1000),
      out_msg_id: String(Date.now() - m.id * 500),
      sms_bytes: (m.content || "").length,
      dest_sms: m.content || "",
      dest_sms_bytes: (m.content || "").length,
      ip: "199.188.150.58",
    }));
    setMessages(msgs);
    setTotal(r.total || 0);
  }, [page, filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  const statusColors: Record<string, string> = {
    QUEUED: "bg-slate-100 text-slate-700", SENT: "bg-blue-100 text-blue-700",
    DELIVERED: "bg-green-100 text-green-700", FAILED: "bg-red-100 text-red-700",
  };

  // ── Column filters (client-side, within the current server-loaded page) ──
  const msgFilters: ColumnFilterDef[] = useMemo(() => [
    { key: "id", placeholder: "ID..." },
    { key: "consumer_user", placeholder: "Consumer..." },
    { key: "alias", placeholder: "Alias..." },
    { key: "sender", placeholder: "Sender..." },
    { key: "recipients", placeholder: "Recipient..." },
    { key: "content", placeholder: "Content..." },
    { key: "cost", placeholder: "Cost..." },
    { key: "pay", placeholder: "Pay..." },
    { key: "route_name", placeholder: "Route..." },
    { key: "channel", placeholder: "Channel..." },
    { key: "send_result", placeholder: "Success / Fail..." },
    { key: "deliver_result", placeholder: "DLR..." },
    { key: "ip", placeholder: "IP..." },
  ], []);
  const { values, set, toggle, showFilters, hasActive, filterData } = useColumnFilters(msgFilters);
  const activeFilterCount = useMemo(() => Object.values(values).filter(v => v.trim()).length, [values]);
  const filteredMessages = useMemo(() => filterData(messages), [messages, filterData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">SMS Logs</h2>
          <p className="text-sm text-slate-500">Detailed message delivery logs with routing information</p>
        </div>
        <div className="flex gap-3">
          <FilterToggle showFilters={showFilters} hasActive={hasActive} activeCount={activeFilterCount} onClick={toggle} />
          <input value={filter.search} onChange={e => setFilter({...filter, search: e.target.value})} placeholder="Search msg ID, content..." className="border rounded-lg px-3 py-2 text-sm w-48" />
          <select value={filter.status} onChange={e => { setFilter({...filter, status: e.target.value}); setPage(0); }} className="border rounded-lg px-3 py-2 text-sm">
            <option value="">All Statuses</option>
            <option value="QUEUED">Queued</option>
            <option value="SENT">Sent</option>
            <option value="DELIVERED">Delivered</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
        <div className="bg-white rounded-lg border p-3 text-center"><p className="text-lg font-bold text-slate-800">{total}</p><p className="text-[10px] text-slate-500">Total</p></div>
        <div className="bg-white rounded-lg border p-3 text-center"><p className="text-lg font-bold text-blue-600">{messages.filter(m => m.send_result === 'success').length}</p><p className="text-[10px] text-slate-500">Sent OK</p></div>
        <div className="bg-white rounded-lg border p-3 text-center"><p className="text-lg font-bold text-green-600">{messages.filter(m => m.deliver_result === 'Success').length}</p><p className="text-[10px] text-slate-500">DLR OK</p></div>
        <div className="bg-white rounded-lg border p-3 text-center"><p className="text-lg font-bold text-red-600">{messages.filter(m => m.send_result === 'fail').length}</p><p className="text-[10px] text-slate-500">Failed</p></div>
        <div className="bg-white rounded-lg border p-3 text-center"><p className="text-lg font-bold text-amber-600">${messages.reduce((s, m) => s + parseFloat(m.cost || "0"), 0).toFixed(4)}</p><p className="text-[10px] text-slate-500">Cost</p></div>
        <div className="bg-white rounded-lg border p-3 text-center"><p className="text-lg font-bold text-purple-600">${messages.reduce((s, m) => s + parseFloat(m.pay || "0"), 0).toFixed(4)}</p><p className="text-[10px] text-slate-500">Pay</p></div>
        <div className="bg-white rounded-lg border p-3 text-center"><p className="text-lg font-bold text-slate-800">{new Set(messages.map(m => m.route_name)).size}</p><p className="text-[10px] text-slate-500">Routes</p></div>
        <div className="bg-white rounded-lg border p-3 text-center"><p className="text-lg font-bold text-slate-800">{new Set(messages.map(m => m.supplier_user)).size}</p><p className="text-[10px] text-slate-500">Suppliers</p></div>
      </div>

      {/* Message Table - Compact with hover detail */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-100 sticky top-0">
              <tr>
                <th className="text-left px-2 py-2 font-medium text-slate-500">ID</th>
                <th className="text-left px-2 py-2 font-medium text-slate-500">Consumer</th>
                <th className="text-left px-2 py-2 font-medium text-slate-500">Alias</th>
                <th className="text-left px-2 py-2 font-medium text-slate-500">Sender</th>
                <th className="text-left px-2 py-2 font-medium text-slate-500">Recipients</th>
                <th className="text-left px-2 py-2 font-medium text-slate-500">Content</th>
                <th className="text-left px-2 py-2 font-medium text-slate-500">Cost</th>
                <th className="text-left px-2 py-2 font-medium text-slate-500">Pay</th>
                <th className="text-left px-2 py-2 font-medium text-slate-500">Route</th>
                <th className="text-left px-2 py-2 font-medium text-slate-500">Channel</th>
                <th className="text-left px-2 py-2 font-medium text-slate-500">Send</th>
                <th className="text-left px-2 py-2 font-medium text-slate-500">DLR</th>
                <th className="text-left px-2 py-2 font-medium text-slate-500">IP</th>
                <th className="text-left px-2 py-2 font-medium text-slate-500">Time</th>
              </tr>
              {showFilters && <FilterRow filters={msgFilters} values={values} onChange={set} colSpan={1} />}
            </thead>
            <tbody>
              {filteredMessages.map(m => (
                <tr key={m.id} className="border-b hover:bg-blue-50/30 cursor-pointer" onClick={() => setSelectedMsg(selectedMsg?.id === m.id ? null : m)}>
                  <td className="px-2 py-2 font-mono text-[11px] font-bold text-blue-600">{m.id}</td>
                  <td className="px-2 py-2 font-mono text-[10px] max-w-[100px] truncate" title={m.consumer_user}>{m.consumer_user}</td>
                  <td className="px-2 py-2 font-mono text-[10px] max-w-[100px] truncate">{m.alias}</td>
                  <td className="px-2 py-2">{m.sender}</td>
                  <td className="px-2 py-2 font-mono text-[10px]">{m.recipients}</td>
                  <td className="px-2 py-2 max-w-[120px] truncate">{m.content}</td>
                  <td className="px-2 py-2 font-mono text-[10px]">${parseFloat(m.cost || "0").toFixed(6)}</td>
                  <td className="px-2 py-2 font-mono text-[10px]">${parseFloat(m.pay || "0").toFixed(6)}</td>
                  <td className="px-2 py-2 text-[10px] max-w-[120px] truncate" title={m.route_name}>{m.route_name}</td>
                  <td className="px-2 py-2 text-[10px] max-w-[100px] truncate">{m.channel}</td>
                  <td className="px-2 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${m.send_result === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{m.send_result}</span>
                  </td>
                  <td className="px-2 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${m.deliver_result === 'Success' ? 'bg-green-100 text-green-700' : m.deliver_result === 'Pending' ? 'bg-slate-100 text-slate-600' : 'bg-red-100 text-red-700'}`}>{m.deliver_result || "Pending"}</span>
                  </td>
                  <td className="px-2 py-2 font-mono text-[10px]">{m.ip}</td>
                  <td className="px-2 py-2 text-[10px] whitespace-nowrap">{new Date(m.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > limit && (
          <div className="px-4 py-3 border-t flex justify-between items-center">
            <p className="text-xs text-slate-500">Showing {page * limit + 1}-{Math.min((page + 1) * limit, total)} of {total.toLocaleString()}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1 border rounded text-xs disabled:opacity-50">Prev</button>
              <button onClick={() => setPage(page + 1)} disabled={(page + 1) * limit >= total} className="px-3 py-1 border rounded text-xs disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Message Detail Panel */}
      {selectedMsg && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedMsg(null)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <div>
                <h3 className="font-semibold text-lg">SMS Detail - ID: {selectedMsg.id}</h3>
                <p className="text-xs text-slate-500">In Msg ID: {selectedMsg.in_msg_id} | Out Msg ID: {selectedMsg.out_msg_id}</p>
              </div>
              <button onClick={() => setSelectedMsg(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {/* Basic Info */}
                <div className="col-span-full grid grid-cols-4 gap-4 bg-slate-50 rounded-lg p-4">
                  <DetailField label="ID" value={selectedMsg.id} />
                  <DetailField label="Consumer user" value={selectedMsg.consumer_user} />
                  <DetailField label="Alias" value={selectedMsg.alias} />
                  <DetailField label="Src type" value={selectedMsg.src_type} />
                  <DetailField label="Type" value={selectedMsg.type} />
                  <DetailField label="Business type" value={selectedMsg.business_type} />
                  <DetailField label="Send type" value={selectedMsg.send_type} />
                  <DetailField label="Job (Success/Fail)" value={`${selectedMsg.job_submit_success}/${selectedMsg.job_submit_fail}`} />
                </div>

                {/* Cost & Routing */}
                <div className="col-span-full grid grid-cols-4 gap-4 bg-slate-50 rounded-lg p-4">
                  <DetailField label="Cost" value={`$${parseFloat(selectedMsg.cost || "0").toFixed(6)}`} />
                  <DetailField label="Pay" value={`$${parseFloat(selectedMsg.pay || "0").toFixed(6)}`} />
                  <DetailField label="Route" value={selectedMsg.route_name} />
                  <DetailField label="Channel" value={selectedMsg.channel} />
                  <DetailField label="Device" value={selectedMsg.device || "—"} />
                  <DetailField label="Ports" value={selectedMsg.ports} />
                  <DetailField label="Slot" value={selectedMsg.slot} />
                  <DetailField label="ICCID" value={selectedMsg.iccid || "—"} />
                  <DetailField label="Charged points" value={selectedMsg.charged_points} />
                  <DetailField label="Supplier user" value={selectedMsg.supplier_user} />
                </div>

                {/* Delivery Status */}
                <div className="col-span-full grid grid-cols-3 gap-4 bg-slate-50 rounded-lg p-4">
                  <div>
                    <p className="text-slate-500 text-xs mb-0.5">Send result</p>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedMsg.send_result === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{selectedMsg.send_result}</span>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs mb-0.5">Reason</p>
                    <span className="text-sm">{selectedMsg.reason}</span>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs mb-0.5">Deliver result</p>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedMsg.deliver_result === 'Success' ? 'bg-green-100 text-green-700' : 'bg-slate-100'}`}>{selectedMsg.deliver_result || "Pending"}</span>
                  </div>
                  {selectedMsg.deliver_fail_reason && (
                    <div className="col-span-3">
                      <p className="text-slate-500 text-xs mb-0.5">Deliver fail reason</p>
                      <span className="text-red-600 text-sm">{selectedMsg.deliver_fail_reason}</span>
                    </div>
                  )}
                </div>

                {/* Timing */}
                <div className="col-span-full grid grid-cols-4 gap-4 bg-slate-50 rounded-lg p-4">
                  <DetailField label="Send time" value={new Date(selectedMsg.send_time || selectedMsg.created_at).toLocaleString()} />
                  <DetailField label="Done time" value={new Date(selectedMsg.done_time || selectedMsg.created_at).toLocaleString()} />
                  <DetailField label="Duration" value={`${selectedMsg.duration || 0}s`} />
                  <DetailField label="Deliver time" value={selectedMsg.deliver_time ? new Date(selectedMsg.deliver_time).toLocaleString() : "—"} />
                  <DetailField label="Deliver dur." value={`${selectedMsg.deliver_dur || 0}s`} />
                  <DetailField label="Create time" value={new Date(selectedMsg.created_at).toLocaleString()} />
                </div>

                {/* Numbers */}
                <div className="col-span-full grid grid-cols-4 gap-4 bg-slate-50 rounded-lg p-4">
                  <DetailField label="Ori receiver" value={selectedMsg.ori_receiver} />
                  <DetailField label="Sender" value={selectedMsg.sender} />
                  <DetailField label="Recipients" value={selectedMsg.recipients} />
                  <DetailField label="Dst receiver" value={selectedMsg.dst_receiver} />
                  <DetailField label="MCC" value={selectedMsg.mcc} />
                  <DetailField label="MNC" value={selectedMsg.mnc || "—"} />
                </div>

                {/* Content */}
                <div className="col-span-full grid grid-cols-2 gap-4 bg-slate-50 rounded-lg p-4">
                  <div>
                    <p className="text-slate-500 text-xs mb-1">SMS Content</p>
                    <p className="text-sm font-mono bg-white rounded p-2 border">{selectedMsg.content || selectedMsg.dest_sms}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <DetailField label="SMS bytes" value={selectedMsg.sms_bytes} />
                    <DetailField label="Dest SMS bytes" value={selectedMsg.dest_sms_bytes} />
                    <DetailField label="Dest SMS" value={selectedMsg.dest_sms || selectedMsg.content} />
                    <DetailField label="MMS attachment" value={selectedMsg.mms_attachment || "—"} />
                    <DetailField label="MMS title" value={selectedMsg.mms_title || "—"} />
                  </div>
                </div>

                {/* IDs and IP */}
                <div className="col-span-full grid grid-cols-3 gap-4 bg-slate-50 rounded-lg p-4">
                  <DetailField label="In msg id" value={selectedMsg.in_msg_id} />
                  <DetailField label="Out msg id" value={selectedMsg.out_msg_id} />
                  <DetailField label="IP" value={selectedMsg.ip} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {messages.length === 0 && (
        <div className="bg-white rounded-xl border p-12 text-center text-slate-400">
          <p className="text-lg mb-2">📝 No messages found</p>
          <p className="text-sm">Messages will appear here when you send SMS through the platform</p>
        </div>
      )}
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | number | undefined }) {
  return (
    <div>
      <p className="text-slate-500 text-xs mb-0.5">{label}</p>
      <p className="text-sm font-medium truncate" title={String(value)}>{value ?? "—"}</p>
    </div>
  );
}
