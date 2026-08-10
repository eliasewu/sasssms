"use client";

// Renders who made an audit change. The 0038/0039 triggers record unattended
// writes (cron jobs, raw SQL, future APIs) as changed_by = 'system/script' —
// surface that distinctly instead of showing it like a human admin email, so
// admins can tell at a glance whether a toggle came from the UI or elsewhere.
export default function AuditActor({ actor, className = "" }: { actor: string; className?: string }) {
  // 'system/script' today; any future 'system/<source>' variants match too.
  const isSystem = actor.startsWith("system/");
  if (isSystem) {
    return (
      <span
        className="inline-flex items-center gap-1 bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide"
        title={`${actor} — changed via script/API, not a human admin`}
      >
        🤖 System
      </span>
    );
  }
  return <span className={`text-slate-600 ${className}`}>{actor}</span>;
}
