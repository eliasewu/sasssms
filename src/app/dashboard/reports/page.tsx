"use client";

import { useState, useEffect, useCallback } from "react";

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

  const v = (data.volume as Array<{period:string;count:string;revenue:string}>)||[];
  const totalMsgs = v.reduce((s:number,x:{count:string})=>s+parseInt(x.count),0);
  const totalRev = v.reduce((s:number,x:{revenue:string})=>s+parseFloat(x.revenue),0);
  const maxVol = Math.max(...v.map((x:{count:string})=>parseInt(x.count)),1);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div><h2 className="text-xl font-bold text-slate-800">Reports & Analytics</h2><p className="text-sm text-slate-500">SMS traffic and DLR reporting</p></div>
        <div className="flex gap-2">
          <select value={type} onChange={e=>setType(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="hourly">Hourly</option><option value="daily">Daily</option><option value="monthly">Monthly</option></select>
          <input type="date" value={start} onChange={e=>setStart(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"/>
          <input type="date" value={end} onChange={e=>setEnd(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"/>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Total Messages</p><p className="text-2xl font-bold">{totalMsgs.toLocaleString()}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Total Revenue</p><p className="text-2xl font-bold text-green-600">${totalRev.toFixed(4)}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Active Clients</p><p className="text-2xl font-bold text-blue-600">{(data.byClient as Array<unknown>)?.length||0}</p></div>
        <div className="bg-white rounded-xl border p-4"><p className="text-sm text-slate-500">Suppliers</p><p className="text-2xl font-bold text-purple-600">{(data.bySupplier as Array<unknown>)?.length||0}</p></div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold mb-4">Volume ({type})</h3>
        <div className="flex items-end gap-1 h-40 overflow-x-auto">
          {v.map((x:{period:string;count:string;revenue:string},i:number)=>{
            const h=(parseInt(x.count)/maxVol)*100;
            return (<div key={i} className="flex flex-col items-center min-w-[20px] flex-1 group relative">
              <div className="absolute -top-6 bg-slate-800 text-white text-xs px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">{x.count} msgs</div>
              <div className="w-full bg-blue-500 rounded-t" style={{height:`${Math.max(h,1)}%`}}/>
              <span className="text-[9px] text-slate-400 -bottom-5 absolute">{new Date(x.period).toLocaleDateString(undefined,{month:"short",day:"numeric"})}</span>
            </div>);
          })}
        </div>
      </div>
    </div>
  );
}
