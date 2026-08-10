"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { APK_VERSION, APK_SIZE_MB } from "@/lib/apk-config";

export default function AndroidAppPage() {
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadingLink, setLoadingLink] = useState(true);

  useEffect(() => {
    fetch("/api/tenant/android-app/share-link")
      .then((r) => r.json())
      .then((data) => {
        if (data.downloadUrl) setShareLink(data.downloadUrl);
      })
      .catch(() => {})
      .finally(() => setLoadingLink(false));
  }, []);

  const handleCopy = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          📱 SMS Gateway Mobile Apps
        </h1>
        <p className="text-slate-500">
          Turn your phone into an SMS gateway that connects over SMPP or
          REST/HTTP. Available for Android — iOS coming soon. Auto-connects to
          all Net2APP servers.
        </p>
      </div>

      {/* Android Download Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🤖</span>
          <h2 className="text-lg font-semibold text-slate-800">Android</h2>
          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">Available</span>
        </div>
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow">
            N
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-800">
              net2app v{APK_VERSION}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Production-signed APK · {APK_SIZE_MB} MB · Android 7.0+
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                ✅ Production Signed
              </span>
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                SMPP v3.4
              </span>
              <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">
                🌐 REST/HTTP Mode
              </span>
              <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                🚀 High-TPS Ready
              </span>
            </div>
          </div>
        </div>

        <a
          href="/api/tenant/android-app/download"
          className="mt-5 w-full py-3 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition text-center block"
        >
          ⬇️ Download APK v{APK_VERSION} ({APK_SIZE_MB} MB)
        </a>

        {/* Shareable Link + QR */}
        <div className="mt-4 bg-slate-50 rounded-lg border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500 mb-3">
            📲 Scan or copy this link to download on another device (no login required)
          </p>
          {loadingLink ? (
            <div className="flex items-center gap-4">
              <div className="w-28 h-28 bg-slate-200 animate-pulse rounded-lg shrink-0" />
              <div className="flex-1">
                <div className="h-9 bg-slate-200 animate-pulse rounded" />
              </div>
            </div>
          ) : shareLink ? (
            <div className="flex items-start gap-4">
              {/* QR Code */}
              <div className="shrink-0 bg-white rounded-lg border border-slate-200 p-1.5">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareLink)}&margin=8&bgcolor=ffffff&color=1e293b`}
                  alt="Scan to download APK"
                  className="w-28 h-28 rounded"
                  width={112}
                  height={112}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              {/* Copy link */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareLink}
                    className="flex-1 text-xs font-mono bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-600 truncate"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    onClick={handleCopy}
                    className={`shrink-0 px-4 py-2 rounded-lg text-xs font-medium transition ${
                      copied
                        ? "bg-green-600 text-white"
                        : "bg-slate-700 text-white hover:bg-slate-800"
                    }`}
                  >
                    {copied ? "✅ Copied!" : "📋 Copy"}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">
                  Point your phone camera at the QR code to download instantly.
                  Token does not expire.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-red-500">
              Could not generate shareable link. Please try refreshing.
            </p>
          )}
        </div>
      </div>

      {/* iOS Card — Coming Soon */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6 opacity-80">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg">🍎</span>
          <h2 className="text-lg font-semibold text-slate-800">iOS (iPhone)</h2>
          <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">Coming Soon</span>
        </div>
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-slate-300 to-slate-400 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shrink-0">
            N
          </div>
          <div className="flex-1">
            <h3 className="text-base font-medium text-slate-700">
              net2app for iOS
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              The iOS version is currently in development. It will offer the same
              SMPP gateway functionality — turn your iPhone into an SMS gateway
              with auto-discovery, background connectivity, and real-time DLR.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                🔨 In Development
              </span>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                SMPP v3.4
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              iOS requires a Mac with Xcode to build. We&apos;re working on it —
              check back soon or{" "}
              <Link href="/contact" className="text-blue-600 hover:underline">
                contact us
              </Link>{" "}
              to be notified when it&apos;s available.
            </p>
          </div>
        </div>
      </div>

      {/* How to Install */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          📋 How to Install &amp; Set Up
        </h2>
        <ol className="space-y-3 text-sm text-slate-600">
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              1
            </span>
            <span>
              <strong>Download the APK</strong> on your Android phone and open
              it. Tap <em>Install</em> when prompted (you may need to allow
              &ldquo;Unknown sources&rdquo; in Settings).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              2
            </span>
            <div>
              <p>
                <strong>Create an ANDROID_SMS supplier</strong> in your
                dashboard at{" "}
                <Link
                  href="/dashboard/suppliers"
                  className="text-blue-600 hover:underline"
                >
                  Suppliers →
                </Link>
                . Set system_type to <code>ANDROID_SMS</code>. Save the{" "}
                <strong>SMPP username &amp; password</strong> you set — the app
                will ask for them.
              </p>
              <Link
                href="/dashboard/suppliers?create=ANDROID_SMS"
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition"
              >
                🚀 Create ANDROID_SMS Supplier
              </Link>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              3
            </span>
            <span>
              <strong>Open the app</strong> — on first launch it will ask for
              your <strong>SMPP username and password</strong>. Enter your
              supplier&apos;s credentials and the app auto-discovers and binds
              to Net2APP servers on port 2775 (or choose{" "}
              <strong>REST/HTTP</strong> mode when no inbound port can be
              reached).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              4
            </span>
            <span>
              <strong>Grant SMS permissions</strong> when the app prompts you.
              These are required to send and receive SMS through your
              phone&apos;s cellular radio.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              5
            </span>
            <span>
              <strong>Route SMS through the app</strong> — create a route in{" "}
              <Link
                href="/dashboard/routes"
                className="text-blue-600 hover:underline"
              >
                Routes →
              </Link>{" "}
              that directs traffic to your ANDROID_SMS supplier trunk.
            </span>
          </li>
        </ol>
      </div>

      {/* Features */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">
          ✨ Features
        </h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            "Dual connection mode — SMPP bind or REST/HTTP",
            "Multi-server SMPP connectivity",
            "Auto server discovery",
            "24/7 background service",
            "Real-time MT/MO counters",
            "Delivery reports (DLR)",
            "Auto-reconnect on failures",
            "Auto-start on boot",
            "Activity log + reconnect counter",
            "Dual-SIM detection & selection",
            "Battery-optimization exemption",
            "Default SMS app setup",
            "Crash reporting (remote diagnostics)",
            "High-TPS paced SMS queue",
            "Remote server IP/port override",
          ].map((f) => (
            <div key={f} className="flex items-center gap-2 text-slate-600">
              <span className="text-green-500 shrink-0">✓</span>
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Permissions */}
      <div className="bg-amber-50 rounded-xl border border-amber-200 p-5 mb-6">
        <h3 className="text-sm font-semibold text-amber-800 mb-2">
          🔐 Required Permissions
        </h3>
        <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
          <li>
            <strong>SMS (send/receive)</strong> — core SMS gateway function
          </li>
          <li>
            <strong>Phone state</strong> — SIM carrier detection (MCC/MNC)
          </li>
          <li>
            <strong>Foreground service</strong> — keeps SMPP connections alive
          </li>
          <li>
            <strong>Boot complete</strong> — auto-starts after reboot
          </li>
        </ul>
      </div>

      {/* Privacy */}
      <p className="text-xs text-slate-400 text-center">
        By downloading, you agree to our{" "}
        <Link href="/privacy" className="text-blue-600 hover:underline">
          Privacy Policy
        </Link>
        . The app processes SMS content transiently and never permanently stores
        messages on the device.
      </p>
    </div>
  );
}
