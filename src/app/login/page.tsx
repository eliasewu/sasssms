"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [info, setInfo] = useState("");

  // Safe redirect target after login (never leave the site)
  const getRedirectPath = (): string => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    if (redirect) {
      try {
        const url = new URL(redirect, window.location.origin);
        if (url.origin !== window.location.origin) return "/dashboard";
        const path = url.pathname + url.search + url.hash;
        if (path.startsWith("/n8n")) {
          window.location.href = path;
          return "";
        }
        return path;
      } catch { /* invalid URL, ignore */ }
    }
    return "/dashboard";
  };

  // Surface auth_error from Google callback and prefill info messages
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError === "account_suspended") setError("Your account has been suspended. Please contact support.");
    else if (authError === "google_failed") setError("Google sign-in failed. Please try again or use email/password.");
    else if (authError === "access_denied") setError("Google sign-in was cancelled. You can try again.");
    const msg = params.get("message");
    if (msg === "password_reset") setInfo("Your password has been reset. Please sign in with your new password.");
    // clean up query params so refresh doesn't re-show stale errors,
    // while preserving other params (e.g. redirect) for the post-login flow
    if (authError || msg) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete("auth_error");
      clean.searchParams.delete("message");
      window.history.replaceState({}, "", clean.pathname + clean.search + clean.hash);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setInfo("");
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error || "Login failed. Please try again.");
      const redirect = getRedirectPath();
      if (redirect) router.push(redirect);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    setGoogleLoading(true);
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    window.location.href = `/api/auth/google?mode=login${redirect ? `&redirect=${encodeURIComponent(redirect)}` : ""}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">N</div>
          <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Net2APP</span>
        </div>
        <h2 className="text-2xl font-bold mb-1">Welcome Back</h2>
        <p className="text-gray-500 mb-6 text-sm">Sign in to your tenant dashboard</p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm mb-4">{error}</div>}
        {info && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2.5 rounded-lg text-sm mb-4">{info}</div>}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input name="email" type="email" required autoComplete="email"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input name="password" type="password" required autoComplete="current-password"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none transition" />
          </div>
          <div className="text-right">
            <Link href="/auth/forgot-password" className="text-xs text-blue-600 hover:text-blue-700 font-medium">Forgot password?</Link>
          </div>
          <button disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 rounded-lg font-semibold disabled:opacity-50 shadow-lg">
            {loading ? "Signing in..." : "Sign In"}
          </button>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>
            <div className="relative flex justify-center text-xs"><span className="bg-white px-3 text-gray-400">or continue with</span></div>
          </div>
          <button type="button" onClick={handleGoogleAuth} disabled={googleLoading}
            className="w-full flex items-center justify-center gap-2 border-2 border-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 transition">
            <GoogleIcon /> {googleLoading ? "Redirecting..." : "Google"}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-gray-500">
          Don&apos;t have an account?
          <Link href="/" className="text-blue-600 font-medium ml-1 hover:underline">Get Started</Link>
        </p>
        <Link href="/" className="block text-center mt-3 text-sm text-gray-400 hover:text-gray-600 mx-auto">← Back to Home</Link>
        <p className="text-center text-xs text-slate-400 mt-6">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p>
      </div>
    </div>
  );
}
