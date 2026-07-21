export default function InboxLoading() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">SMS Inbox (MO)</h2>
        <p className="text-sm text-slate-500">Mobile-originated incoming messages</p>
      </div>
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="animate-pulse">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-4 px-5 py-4 border-b">
              <div className="h-4 bg-slate-200 rounded w-24" />
              <div className="h-4 bg-slate-200 rounded w-28" />
              <div className="h-4 bg-slate-200 rounded w-64 flex-1" />
              <div className="h-4 bg-slate-200 rounded w-32" />
              <div className="h-4 bg-slate-200 rounded w-14" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
