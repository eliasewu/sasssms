"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

interface Admin { id: number; name: string; email: string; }

const navItems = [
  { href: "/super/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/super/dashboard/tenants", label: "Tenants", icon: "🏢" },
  { href: "/super/dashboard/packages", label: "Packages", icon: "📦" },
  { href: "/super/dashboard/payments", label: "Payment Approvals", icon: "💳" },
  { href: "/super/dashboard/email-accounts", label: "Email Accounts", icon: "📧" },
  { href: "/super/dashboard/admins", label: "Admins", icon: "🔐" },
  { href: "/super/dashboard/mcc-mnc", label: "MCC/MNC Database", icon: "🌍" },
  { href: "/super/dashboard/notifications", label: "Alerts", icon: "🔔" },
  { href: "/super/dashboard/settings", label: "Settings", icon: "⚙️" },
];

export default function SuperDashboardLayout({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchAdmin = useCallback(async () => {
    try {
      const res = await fetch("/api/super/auth/me", { credentials: "include" });
      if (!res.ok) {
        router.push("/super");
        return;
      }
      const data = await res.json();
      setAdmin(data.admin);
    } catch {
      router.push("/super");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { fetchAdmin(); }, [fetchAdmin]);

  const handleLogout = async () => {
    await fetch("/api/super/auth/logout", { method: "POST", credentials: "include" });
    router.push("/super");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4 animate-pulse">N</div>
          <p className="text-slate-500">Loading admin portal...</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return null;
  }

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col min-h-screen fixed left-0 top-0 bottom-0 z-30">
        <div className="p-4 flex items-center gap-3 border-b border-white/10">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center font-bold text-lg shadow">N</div>
          <div>
            <span className="font-bold text-sm block">Net2APP</span>
            <span className="text-xs text-slate-400">Admin Portal</span>
          </div>
        </div>

        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                pathname === item.href
                  ? "bg-orange-600 text-white"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="mb-3">
            <p className="text-xs text-slate-400 truncate font-medium">{admin.name}</p>
            <p className="text-xs text-slate-500 truncate">{admin.email}</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition w-full">
            <span>🚪</span>
            <span>Logout</span>
          </button>
        </div>

        <div className="p-4 border-t border-white/10">
          <p className="text-[10px] text-slate-500 text-center">
            © {new Date().getFullYear()} Tri Angle Trade Centre Fze LLC
          </p>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 ml-64">
        <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-20 shadow-sm">
          <div className="flex items-center justify-between">
            <h1 className="font-semibold text-slate-800 text-lg">
              {navItems.find((n) => n.href === pathname)?.label || "Dashboard"}
            </h1>
            <span className="text-sm bg-orange-50 text-orange-700 px-3 py-1.5 rounded-full font-medium border border-orange-200">
              Super Administrator
            </span>
          </div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
