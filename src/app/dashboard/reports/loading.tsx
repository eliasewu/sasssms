export default function ReportsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="h-7 bg-slate-200 rounded w-48" />
          <div className="h-4 bg-slate-100 rounded w-72 mt-2" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 bg-slate-200 rounded-lg w-24" />
          <div className="h-10 bg-slate-200 rounded-lg w-36" />
          <div className="h-10 bg-slate-200 rounded-lg w-36" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border p-4">
            <div className="h-3 bg-slate-100 rounded w-24 mb-2" />
            <div className="h-8 bg-slate-200 rounded w-16" />
          </div>
        ))}
      </div>

      {/* Chart skeletons */}
      <div className="bg-white rounded-xl border p-6">
        <div className="h-5 bg-slate-200 rounded w-32 mb-4" />
        <div className="flex items-end gap-1 h-40">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-slate-100 rounded-t"
              style={{ height: `${20 + Math.random() * 80}%` }}
            />
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border p-6">
        <div className="h-5 bg-slate-200 rounded w-48 mb-4" />
        <div className="space-y-1">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="h-3 bg-slate-100 rounded w-16" />
              <div className="flex-1 h-4 bg-slate-100 rounded" style={{ width: `${30 + Math.random() * 70}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
