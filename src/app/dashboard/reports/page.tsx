"use client";

import { useState, useEffect, useCallback } from "react";

interface VolumePoint { period: string; count: string; revenue: string; cost: string; profit: string; }
interface ClientSummary { client_id: number; client_name: string; count: number; revenue: number; cost: number; profit: number; }
interface SupplierSummary { supplier_id: number; supplier_name: string; count: number; cost: number; }

export default function ReportsPage() {
  const [data, setData] = useState<Record<string,unknown>|null>(null);
  const [type, setType] = useState("daily");
  const [start, setStart] = useState(() => new Date(Date.now()-30*864e5).toISOString().slice(0,10));
  const [end, setEnd] = useState(new Date().toISOString().slice(0,10));

  const load = useCallback(async () => {
    const r = await fetch(`/api/tenant/reports?type=${type}&startDate=${new Date(start).toISOString()}&endDate=${new Date(end).toISOString()}`).then(r=>r.json());
    setData(r);
  }, [type,start,end]);

  useEffect(()=>{load();},[load]);

  if(!data) return <div className="p-8 text-slate-400 animate-pulse">Loading reports...</div>;

  const v = (data.volume as VolumePoint[])||[];
  const totalMsgs = v.reduce((s,x)=>s+parseInt(x.count||"0"),0);
  const totalRev = v.reduce((s,x)=>s+parseFloat(x.revenue||"0"),0);
  const totalCost = v.reduce((s,x)=>s+parseFloat(x.cost||"0"),0);
  const totalProfit = v.reduce((s,x)=>s+parseFloat(x.profit||"0"),0);
  const maxVol = Math.max(...v.map(x=>parseInt(x.count||"0")),1);
  const byClient = (data.byClient as ClientSummary[])||[];
  const bySupplier = (data.bySupplier as SupplierSummary[])||[];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div><h2 className="text-xl font-bold text-slate-800">Reports & Analytics</h2><p className="text-sm text-slate-500">SMS traffic, revenue, cost, and profit reporting</p></div>
        <div className="flex gap-2">
          <select value={type} onChange={e=>setType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="monthly">Monthly</option></select>
          <input type="date" value={start} onChange={e=>setStart(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"/>
          <input type="date" value={end} onChange={e=>setEnd(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"/>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Total Messages</p><p className="text-2xl font-bold">{totalMsgs.toLocaleString()}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Revenue</p><p className="text-2xl font-bold text-blue-600">${totalRev.toFixed(4)}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Cost</p><p className="text-2xl font-bold text-amber-600">${totalCost.toFixed(4)}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Profit</p><p className={`text-2xl font-bold ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>${totalProfit.toFixed(4)}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Active Clients</p><p className="text-2xl font-bold text-indigo-600">{byClient.length}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Suppliers</p><p className="text-2xl font-bold text-purple-600">{bySupplier.length}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Avg Revenue/SMS</p><p className="text-2xl font-bold text-blue-500">${totalMsgs > 0 ? (totalRev/totalMsgs).toFixed(6) : "0"}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Profit Margin</p><p className={`text-2xl font-bold ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{totalRev > 0 ? ((totalProfit/totalRev)*100).toFixed(1) : "0"}%</p></div>
      </div>

      {/* Volume Chart */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">Volume ({type})</h3>
        <div className="flex items-end gap-1 h-40 overflow-x-auto">
          {v.map((x,i)=>{
            const h=(parseInt(x.count||"0")/maxVol)*100;
            return (<div key={i} className="flex flex-col items-center min-w-[20px] flex-1 group relative">
              <div className="absolute -top-6 bg-slate-800 text-white text-xs px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">{x.count} msgs</div>
              <div className="w-full bg-blue-500 rounded-t" style={{height:`${Math.max(h,1)}%`}}/>
              <span className="text-[9px] text-slate-400 -bottom-5 absolute">{new Date(x.period).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</span>
            </div>);
          })}
        </div>
      </div>

      {/* Revenue vs Cost vs Profit Chart */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">Revenue / Cost / Profit ({type})</h3>
        <div className="grid grid-cols-3 gap-2 text-center text-xs mb-2">
          <span className="text-blue-600 font-medium">■ Revenue</span>
          <span className="text-amber-600 font-medium">■ Cost</span>
          <span className="text-green-600 font-medium">■ Profit</span>
        </div>
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {v.map((x,i)=>{
            const rev = parseFloat(x.revenue||"0");
            const cost = parseFloat(x.cost||"0");
            const profit = parseFloat(x.profit||"0");
            const maxBar = Math.max(rev, cost, 0.00001);
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-16 text-slate-400 text-right">{new Date(x.period).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</span>
                <div className="flex-1 flex gap-0.5 h-4">
                  <div className="bg-blue-500 rounded" style={{width:`${(rev/maxBar)*100}%`}} title={`Revenue: $${rev.toFixed(6)}`} />
                  <div className="bg-amber-500 rounded" style={{width:`${(cost/maxBar)*100}%`}} title={`Cost: $${cost.toFixed(6)}`} />
                  <div className="bg-green-500 rounded" style={{width:`${Math.max(0,(profit/maxBar))*100}%`}} title={`Profit: $${profit.toFixed(6)}`} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Client Breakdown */}
      {byClient.length > 0 && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold mb-4">By Client</h3>
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className="text-left px-4 py-2">Client</th><th className="text-right px-4 py-2">Messages</th><th className="text-right px-4 py-2">Revenue</th><th className="text-right px-4 py-2">Cost</th><th className="text-right px-4 py-2">Profit</th></tr></thead>
            <tbody>
              {byClient.map((c,i)=>(
                <tr key={i} className="border-t">
                  <td className="px-4 py-2 font-medium">{c.client_name || `#${c.client_id}`}</td>
                  <td className="px-4 py-2 text-right">{c.count.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono text-blue-600">${(c.revenue||0).toFixed(4)}</td>
                  <td className="px-4 py-2 text-right font-mono text-amber-600">${(c.cost||0).toFixed(4)}</td>
                  <td className={`px-4 py-2 text-right font-mono font-bold ${(c.profit||0)>=0?"text-green-600":"text-red-600"}`}>${(c.profit||0).toFixed(4)}</td>
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
            <thead className="bg-slate-50"><tr><th className="text-left px-4 py-2">Supplier</th><th className="text-right px-4 py-2">Messages</th><th className="text-right px-4 py-2">Cost</th></tr></thead>
            <tbody>
              {bySupplier.map((s,i)=>(
                <tr key={i} className="border-t">
                  <td className="px-4 py-2 font-medium">{s.supplier_name || `#${s.supplier_id}`}</td>
                  <td className="px-4 py-2 text-right">{s.count.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right font-mono text-amber-600">${(s.cost||0).toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
