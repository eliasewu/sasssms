"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SuperAdminLoginPage() {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [setupMode, setSetupMode] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if already logged in
    fetch("/api/super/auth/me")
      .then((res) => {
        if (res.ok) {
          router.push("/super/dashboard");
        } else {
          setCheckingAuth(false);
        }
      })
      .catch(() => setCheckingAuth(false));
  }, [router]);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/super/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          email: fd.get("email"), 
          password: fd.get("password") 
        }),
        credentials: "include",
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      // Successful login - redirect
      router.push("/super/dashboard");
    } catch (err) {
      setError("Connection error. Please try again.");
      setLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    const fd = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/super/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: fd.get("email"),
          password: fd.get("password"),
          name: fd.get("name"),
          setupKey: fd.get("setupKey"),
        }),
        credentials: "include",
      });

      const data = await res.json();
      setLoading(false);

      if (!res.ok) {
        setError(data.error || "Setup failed");
        return;
      }

      setSuccess("Super admin created! Redirecting to dashboard...");
      setTimeout(() => {
        router.push("/super/dashboard");
      }, 1500);
    } catch (err) {
      setError("Connection error. Please try again.");
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">N</div>
          <div>
            <span className="text-xl font-bold text-slate-800 block">Net2APP</span>
            <span className="text-xs text-slate-500">Super Administrator Portal</span>
          </div>
        </div>

        {!setupMode ? (
          <>
            <h2 className="text-2xl font-bold mb-1">Admin Login</h2>
            <p className="text-gray-500 mb-6 text-sm">Access the platform administration dashboard</p>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm mb-4">{error}</div>}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
                <input 
                  name="email" 
                  type="email" 
                  required 
                  autoComplete="email"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition" 
                  placeholder="admin@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input 
                  name="password" 
                  type="password" 
                  required 
                  autoComplete="current-password"
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition" 
                />
              </div>
              <button 
                type="submit"
                disabled={loading} 
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition font-semibold disabled:opacity-50 shadow-lg"
              >
                {loading ? "Signing in..." : "Sign In to Admin Portal"}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t text-center">
              <button onClick={() => setSetupMode(true)} className="text-sm text-slate-500 hover:text-slate-700">
                First time setup? Create Super Admin →
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold mb-1">Initial Setup</h2>
            <p className="text-gray-500 mb-6 text-sm">Create the first super administrator account</p>

            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm mb-4">{error}</div>}
            {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-lg text-sm mb-4">{success}</div>}

            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Setup Key</label>
                <input 
                  name="setupKey" 
                  type="password" 
                  required 
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition font-mono" 
                  placeholder="Enter setup key" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Name</label>
                <input 
                  name="name" 
                  required 
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition" 
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email</label>
                <input 
                  name="email" 
                  type="email" 
                  required 
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition" 
                  placeholder="admin@company.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input 
                  name="password" 
                  type="password" 
                  required 
                  minLength={6} 
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-orange-500 outline-none transition" 
                />
              </div>
              <button 
                type="submit"
                disabled={loading} 
                className="w-full bg-gradient-to-r from-orange-500 to-red-600 text-white py-3 rounded-lg hover:from-orange-600 hover:to-red-700 transition font-semibold disabled:opacity-50 shadow-lg"
              >
                {loading ? "Creating Admin..." : "Create Super Admin & Login"}
              </button>
            </form>

            <button onClick={() => { setSetupMode(false); setError(""); }} className="block text-center mt-4 text-sm text-slate-500 hover:text-slate-700 mx-auto">
              ← Back to Login
            </button>
          </>
        )}

        <div className="mt-8 pt-4 border-t text-center">
          <Link href="/" className="text-sm text-blue-600 hover:underline">← Back to Net2APP</Link>
        </div>
        
        <p className="text-center text-xs text-slate-400 mt-4">
          © {new Date().getFullYear()} Tri Angle Trade Centre Fze LLC. All Rights Reserved.
        </p>
      </div>
    </div>
  );
}
