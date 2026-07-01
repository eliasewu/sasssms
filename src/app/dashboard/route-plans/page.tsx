"use client";

import { useState, useEffect, useCallback } from "react";

interface RoutePlan { id: number; name: string; description: string | null; is_active: boolean; routes: Array<{ route_id: number; priority: number; route_name: string; trunk_name: string }>; }
interface Route { id: number; name: string; trunk_name: string; country_code: string; prefix: string; priority: number; is_active: boolean; }

export default function RoutePlansPage() {
  const [plans, setPlans] = useState<RoutePlan[]>([]);
  const [allRoutes, setAllRoutes] = useState<Route[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RoutePlan | null>(null);
  const [form, setForm] = useState({ name: "", description: "", routeIds: [] as number[] });

  const load = useCallback(async () => {
    const [pr, rr] = await Promise.all([
      fetch("/api/tenant/route-plans").then(r => r.json()),
      fetch("/api/tenant/routes").then(r => r.json()),
    ]);
    setPlans(pr.routePlans || []);
    setAllRoutes(rr.routes || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) {
      await fetch(`/api/tenant/route-plans/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, isActive: editing.is_active }),
      });
    } else {
      await fetch("/api/tenant/route-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setShowForm(false); setEditing(null);
    setForm({ name: "", description: "", routeIds: [] });
    load();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this route plan?")) return;
    await fetch(`/api/tenant/route-plans/${id}`, { method: "DELETE" });
    load();
  };

  const toggleRoute = (routeId: number) => {
    setForm(f => ({
      ...f,
      routeIds: f.routeIds.includes(routeId) ? f.routeIds.filter(id => id !== routeId) : [...f.routeIds, routeId],
    }));
  };

  // Routes already assigned to any plan
  const assignedRouteIds = new Set(plans.flatMap(p => p.routes.map(r => r.route_id)));
  // Available routes (not assigned to current plan if editing)
  const editingAssignedIds = editing ? new Set(editing.routes.map(r => r.route_id)) : new Set<number>();
  const availableRoutes = allRoutes.filter(r => !assignedRouteIds.has(r.id) || (editing && editingAssignedIds.has(r.id)));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Route Plans</h2>
          <p className="text-sm text-slate-500">Assign available routes to route plans for client routing</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm({ name: "", description: "", routeIds: [] }); }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
          + Add Route Plan
        </button>
      </div>

      {/* Available Routes Overview */}
      <div className="bg-white rounded-xl border p-5 shadow-sm">
        <h4 className="font-semibold mb-3">📋 Available Routes (showing all routes with their trunks)</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {allRoutes.filter(r => r.is_active).map(r => (
            <div key={r.id} className={`border rounded-lg p-3 text-sm ${assignedRouteIds.has(r.id) ? "bg-slate-50 border-slate-200" : "bg-green-50 border-green-200"}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{r.name}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${assignedRouteIds.has(r.id) ? "bg-slate-200 text-slate-600" : "bg-green-200 text-green-700"}`}>
                  {assignedRouteIds.has(r.id) ? "Assigned" : "Available"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Trunk: {r.trunk_name} {r.country_code ? `• ${r.country_code}` : ""} {r.prefix ? `• ${r.prefix}` : ""}
              </p>
            </div>
          ))}
          {allRoutes.length === 0 && <p className="col-span-full text-slate-400 text-sm">No routes created yet. Create routes first.</p>}
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border p-6 shadow-sm">
          <h3 className="font-semibold mb-4">{editing ? "Edit Route Plan" : "Create Route Plan"}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Select Available Routes</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 max-h-64 overflow-y-auto border rounded-lg p-3">
                {availableRoutes.filter(r => r.is_active).map(r => (
                  <label key={r.id} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition text-sm ${form.routeIds.includes(r.id) ? "border-blue-500 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}>
                    <input type="checkbox" checked={form.routeIds.includes(r.id)} onChange={() => toggleRoute(r.id)} className="accent-blue-600" />
                    <div>
                      <span className="font-medium">{r.name}</span>
                      <p className="text-xs text-slate-500">→ {r.trunk_name} {r.country_code ? `(${r.country_code})` : ""}</p>
                    </div>
                    {form.routeIds.includes(r.id) && (
                      <span className="ml-auto bg-blue-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                        {form.routeIds.indexOf(r.id) + 1}
                      </span>
                    )}
                  </label>
                ))}
                {availableRoutes.filter(r => r.is_active).length === 0 && (
                  <p className="col-span-full text-slate-400 text-sm py-4">All routes are already assigned. Create new routes in Routes section.</p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium">{editing ? "Update" : "Create"}</button>
              <button type="button" onClick={() => setShowForm(false)} className="border px-6 py-2 rounded-lg text-sm">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Route Plans List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {plans.map(p => (
          <div key={p.id} className="bg-white rounded-xl border p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold">{p.name}</h4>
                {p.description && <p className="text-xs text-slate-500">{p.description}</p>}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${p.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {p.is_active ? "Active" : "Inactive"}
              </span>
            </div>

            {/* SMS Flow Visualization */}
            <div className="bg-slate-50 rounded-lg p-3 mb-4">
              <p className="text-xs text-slate-500 mb-2">Routing Flow: ESME → Plan → Routes → Trunks → Suppliers</p>
              <div className="flex flex-wrap items-center gap-1 text-[10px]">
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">ESME</span>
                <span className="text-slate-400">→</span>
                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">Plan</span>
                <span className="text-slate-400">→</span>
                {p.routes.map((r, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded">{r.route_name}</span>
                    {i < p.routes.length - 1 && <span className="text-slate-400">→</span>}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-1.5 mb-4">
              <p className="text-xs text-slate-400 font-medium uppercase">Routes ({p.routes.length})</p>
              {p.routes.map((r, i) => (
                <div key={i} className="flex items-center gap-3 text-sm border-b border-slate-100 pb-1.5">
                  <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">{r.priority}</span>
                  <span className="flex-1">{r.route_name}</span>
                  <span className="text-xs text-slate-400">→ {r.trunk_name}</span>
                </div>
              ))}
              {p.routes.length === 0 && <p className="text-slate-400 text-xs">No routes assigned. Select from available routes above.</p>}
            </div>

            <div className="flex gap-2 border-t pt-3">
              <button onClick={() => {
                setEditing(p);
                setForm({ name: p.name, description: p.description || "", routeIds: p.routes.map(r => r.route_id) });
                setShowForm(true);
              }} className="text-blue-600 hover:underline text-xs">Edit</button>
              <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:underline text-xs">Delete</button>
            </div>
          </div>
        ))}
        {plans.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-400 bg-white rounded-xl border">
            <p>No route plans yet. Create one and assign available routes.</p>
          </div>
        )}
      </div>
    </div>
  );
}
