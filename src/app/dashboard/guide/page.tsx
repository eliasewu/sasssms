import Link from "next/link";
import type { Metadata } from "next";
import ProgressBar from "./progress-bar";

export const metadata: Metadata = {
  title: "Getting Started Guide — Net2APP SMS Platform",
  description:
    "Step-by-step guide to set up your SMS gateway platform: register, top up, add suppliers, configure routes, manage clients, and send your first SMS. Includes video walkthroughs for key steps.",
  openGraph: {
    title: "Getting Started Guide — Net2APP SMS Platform",
    description:
      "Complete walkthrough for setting up your SMS gateway: registration, top-up, suppliers, routes, clients, and testing.",
    type: "article",
  },
};

interface GuideStep {
  number: number;
  title: string;
  icon: string;
  description: string;
  action?: { label: string; href: string };
  tips?: string[];
  videoUrl?: string;
  videoTitle?: string;
}

const steps: GuideStep[] = [
  {
    number: 1,
    title: "Register Your Account",
    icon: "📝",
    description:
      "Go to www.net2app.com and fill in the Sign Up form. Enter your company name, email address, phone number, and choose a password. Select your preferred server location for the best SMS delivery performance. Your account is created instantly with a free Starter plan.",
    action: { label: "Visit Net2APP", href: "https://net2app.com" },
    tips: [
      "Choose a server location closest to your target audience for lower latency",
      "All plans include a free trial period — no credit card required",
      "You can upgrade to Professional or Enterprise anytime from the Billing page",
    ],
  },
  {
    number: 2,
    title: "Top Up Your Balance",
    icon: "💰",
    description:
      "After registration, go to the Billing page and add funds to your account. Choose your preferred cryptocurrency payment method (USDT, BTC, BNB, etc.), enter the amount, and upload a screenshot of your payment. The super admin will review and approve your payment.",
    action: { label: "Go to Billing", href: "/dashboard/billing" },
    tips: [
      "Minimum top-up amount is $25 for Starter plans",
      "Professional plan: $150/month — Enterprise: $399/month",
      "First payment may qualify for bonus SMS credits (check the promo banner)",
    ],
  },
  {
    number: 3,
    title: "Add a Supplier",
    icon: "🏭",
    description:
      "Suppliers are the SMS gateway providers that deliver your messages. Go to Suppliers → All Suppliers and click '+ Add Supplier'. Enter the supplier's name, connection type (SMPP or HTTP API), host, port, username, and password. Configure the bind type (Transceiver, Transmitter, Receiver, or TX+RX).",
    action: { label: "Add Supplier", href: "/dashboard/suppliers" },
    videoUrl: "https://www.youtube.com/embed/PLACEHOLDER_ADD_SUPPLIER",
    videoTitle: "How to Add a Supplier",
    tips: [
      "SMPP v3.4 is the most widely supported version — use it as default",
      "For HTTP API suppliers, enter the API URL and key instead of SMPP credentials",
      "After adding, check the Bind Status page to confirm the connection is BOUND",
    ],
  },
  {
    number: 4,
    title: "Set Supplier Rates",
    icon: "💲",
    description:
      "After adding a supplier, configure their per-destination rates. Go to Rates → Supplier Rates or Bulk Rate Management. Select the supplier, choose a destination country, pick the operator (MCC/MNC), and enter the cost per SMS. Use Bulk Import to add all operators for a country at once.",
    action: { label: "Supplier Rates", href: "/dashboard/suppliers/rates" },
    tips: [
      "Only one rate can be active per destination — adding a new rate auto-deactivates the old one",
      "Use Bulk Rate Management for importing all operators at once with a single rate",
      "Rates can be toggled Active/Inactive without deleting them",
    ],
  },
  {
    number: 5,
    title: "Add a Trunk",
    icon: "🔗",
    description:
      "Trunks connect suppliers to routes. Go to Routing → Trunks and click '+ Add Trunk'. Select the supplier, give the trunk a descriptive name, set the capacity (max concurrent SMS), and configure MCC allow/deny lists if you want to restrict which destinations this trunk handles.",
    action: { label: "Add Trunk", href: "/dashboard/trunks" },
    videoUrl: "https://www.youtube.com/embed/PLACEHOLDER_ADD_TRUNK",
    videoTitle: "How to Add a Trunk",
    tips: [
      "Capacity limits prevent overloading a single supplier connection",
      "MCC allow lists restrict the trunk to specific countries — leave empty for all",
      "MCC deny lists block specific countries — useful for compliance",
    ],
  },
  {
    number: 6,
    title: "Add a Route",
    icon: "🔀",
    description:
      "Routes define the path for SMS delivery. Go to Routing → Routes and click '+ Add Route'. Select the trunk, optionally set a country code and prefix for filtering, and set the priority (lower number = higher priority). Multiple routes with different priorities enable automatic fallback.",
    action: { label: "Add Route", href: "/dashboard/routes" },
    videoUrl: "https://www.youtube.com/embed/PLACEHOLDER_ADD_ROUTE",
    videoTitle: "How to Add a Route",
    tips: [
      "Priority 1 = highest, Priority 10 = lowest",
      "Routes with higher priority are tried first — lower priority routes are fallbacks",
      "Use country code + prefix for granular routing (e.g., route specific operators)",
    ],
  },
  {
    number: 7,
    title: "Create a Route Plan",
    icon: "📋",
    description:
      "Route Plans group multiple routes together for load balancing and failover. Go to Routing → Route Plans and click '+ Add Route Plan'. Give it a name, then link routes to it by selecting them from the available routes list. Each route in the plan gets a priority level for fallback ordering.",
    action: { label: "Route Plans", href: "/dashboard/route-plans" },
    videoUrl: "https://www.youtube.com/embed/PLACEHOLDER_ROUTE_PLAN",
    videoTitle: "How to Create a Route Plan",
    tips: [
      "Default plans are pre-created: Default Plan, SIM OTP, SIM Marketing",
      "A route plan can contain routes from multiple trunks and suppliers",
      "Assign route plans to clients under Clients → Edit Client → Route Plan",
    ],
  },
  {
    number: 8,
    title: "Add a Client",
    icon: "👥",
    description:
      "Clients are the end users who send SMS through your platform. Go to Clients → All Clients and click '+ Add Client'. Enter the client's name, email, phone, SMTP credentials (username/password), allowed IP address, TPS limit, and assign a route plan.",
    action: { label: "Add Client", href: "/dashboard/clients" },
    videoUrl: "https://www.youtube.com/embed/PLACEHOLDER_ADD_CLIENT",
    videoTitle: "How to Add a Client",
    tips: [
      "SMTP username must be unique across all tenants — the system checks automatically",
      "TPS (Transactions Per Second) limits prevent abuse — set appropriately",
      "Enable HTTP API if the client wants RESTful API access instead of SMTP",
      "Force DLR option skips waiting for supplier delivery receipts and marks messages as delivered immediately",
    ],
  },
  {
    number: 9,
    title: "Set Client Rates",
    icon: "💵",
    description:
      "Configure how much to charge each client per SMS. Go to Rates → Client Rates or Bulk Rate Management. Select the client, choose a destination country, pick the operator, and enter the rate. Your profit is the difference between the client rate and the supplier cost.",
    action: { label: "Client Rates", href: "/dashboard/clients/rates" },
    tips: [
      "Only one rate per destination can be active — auto-dedup on save",
      "Use Bulk Rate Management to set rates for all operators at once",
      "Download CSV with markup percentages for reporting and invoicing",
    ],
  },
  {
    number: 10,
    title: "Check Bind Status",
    icon: "🔌",
    description:
      "Verify that your suppliers are connected. Go to Tools → Bind Status to see all supplier connections. The status shows BOUND (connected), UNBOUND (disconnected), or BIND_FAILED (authentication or network error). Suppliers auto-reconnect on failure with exponential backoff.",
    action: { label: "Bind Status", href: "/dashboard/bind-status" },
    tips: [
      "BIND_FAILED usually means wrong username/password or IP not whitelisted",
      "TX_RX mode shows both Transmitter and Receiver status separately",
      "Reconnect happens automatically every 30 seconds with increasing delays up to 5 minutes",
    ],
  },
  {
    number: 11,
    title: "Configure IP Whitelist",
    icon: "🛡️",
    description:
      "Secure your platform by whitelisting client IP addresses. Go to Tools → IP Whitelist and add IP addresses that are allowed to connect. Only clients connecting from whitelisted IPs can access the SMTP server and HTTP API.",
    action: { label: "IP Whitelist", href: "/dashboard/ip-list" },
    tips: [
      "Add IPs in IPv4 format (e.g., 192.168.1.100)",
      "You can whitelist IPs per client for granular access control",
      "A client with no whitelisted IPs can connect from any address",
    ],
  },
  {
    number: 12,
    title: "Test SMS Sending",
    icon: "🧪",
    description:
      "Before going live, send test messages. Go to Testing → Test SMS, select a client, enter the destination number and message content, and click Send. You can also test via SMTP (Test SMTP page) or HTTP API (Test HTTP page). Use free test credits for development.",
    action: { label: "Test SMS", href: "/dashboard/test-sms" },
    tips: [
      "Free test credits refresh periodically — check the header badge",
      "Test different destinations to verify routing and rate matching",
      "Check SMS Logs (Messages page) to verify delivery status",
    ],
  },
  {
    number: 13,
    title: "Monitor DLR & Reports",
    icon: "📈",
    description:
      "Track delivery receipts (DLR) and generate reports. Go to Tools → DLR Status to see pending and delivered messages. Use the Reports page for detailed analytics: message volumes, delivery rates, revenue, and per-MCC statistics.",
    action: { label: "DLR Status", href: "/dashboard/dlr-status" },
    tips: [
      "DLR statuses: PENDING → SENT → DELIVERED (or FAILED)",
      "Reports can be filtered by date range, client, or country",
      "Export data from the Messages page or Bulk Rate Management",
    ],
  },
  {
    number: 14,
    title: "Get Support",
    icon: "🎫",
    description:
      "If you encounter any issues, create a support ticket. Go to Settings → Support Tickets and click '+ New Ticket'. Describe your issue in detail, attach screenshots if helpful, and submit. The Net2APP support team will respond promptly.",
    action: { label: "Support Tickets", href: "/dashboard/support-tickets" },
    tips: [
      "Include your tenant name and any relevant message IDs for faster resolution",
      "Check the Knowledge Base at net2app.com/resources for common questions",
      "Tickets are private — only you and the Net2APP support team can see them",
    ],
  },
];

function VideoSection({ url, title }: { url: string; title?: string }) {
  const isPlaceholder = url.includes("PLACEHOLDER");

  return (
    <details className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden group/details">
      <summary className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-100 transition cursor-pointer list-none">
        <span className="flex items-center gap-2">
          <span className="text-red-500">▶</span>
          {title || "Watch Walkthrough"}
        </span>
        <span className="text-xs text-slate-400 transition-transform group-open:rotate-180">
          ▼
        </span>
      </summary>
      <div className="px-4 pb-4">
        <div className="relative w-full aspect-video bg-slate-900 rounded-lg overflow-hidden">
          {isPlaceholder ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <span className="text-5xl mb-3">🎥</span>
              <p className="text-sm font-medium">Video Walkthrough Coming Soon</p>
              <p className="text-xs text-slate-500 mt-1">
                A step-by-step video for &quot;{title}&quot; is being recorded.
              </p>
            </div>
          ) : (
            <iframe
              src={url}
              title={title || "Walkthrough video"}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </div>
    </details>
  );
}

export default function UserGuidePage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto" style={{ scrollBehavior: "smooth" }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-extrabold mb-2">📘 Getting Started Guide</h1>
        <p className="text-blue-100 text-lg">
          Follow these steps to set up your SMS gateway platform. From registration to sending your first SMS — everything you need.
        </p>
        <div className="flex items-center gap-2 mt-4">
          <span className="bg-white/20 rounded-full px-3 py-1 text-sm">{steps.length} Steps</span>
          <span className="text-blue-200 text-sm">~20 minutes to complete setup</span>
          <span className="bg-white/20 rounded-full px-3 py-1 text-sm">
            🎥 {steps.filter(s => s.videoUrl).length} Videos
          </span>
        </div>
      </div>

      {/* Step Progress Bar — scroll-spy with IntersectionObserver */}
      <ProgressBar
        steps={steps.map((s) => ({
          number: s.number,
          title: s.title,
        }))}
      />

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, idx) => (
          <div
            key={step.number}
            id={`step-${step.number}`}
            className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-md transition group"
          >
            <div className="flex items-start gap-5 p-6">
              {/* Step Number */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow group-hover:scale-105 transition">
                {step.number}
              </div>

              {/* Content */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{step.icon}</span>
                  <h3 className="font-bold text-lg text-slate-800">{step.title}</h3>
                  {step.videoUrl && (
                    <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-medium border border-red-200">
                      🎥 Video
                    </span>
                  )}
                </div>
                <p className="text-slate-600 leading-relaxed">{step.description}</p>

                {/* Video Walkthrough */}
                {step.videoUrl && (
                  <VideoSection url={step.videoUrl} title={step.videoTitle} />
                )}

                {/* Tips */}
                {step.tips && step.tips.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1.5">
                    <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">💡 Tips</p>
                    <ul className="space-y-1">
                      {step.tips.map((tip, i) => (
                        <li key={i} className="text-sm text-amber-700 flex items-start gap-2">
                          <span className="text-amber-400 mt-1 shrink-0">•</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Action Button */}
                {step.action && (
                  <Link
                    href={step.action.href}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition shadow-sm"
                  >
                    {step.action.label} →
                  </Link>
                )}
              </div>
            </div>

            {/* Next Step Navigation */}
            {idx < steps.length - 1 ? (
              <a
                href={`#step-${steps[idx + 1].number}`}
                className="flex items-center justify-center gap-2 border-t border-slate-100 px-6 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 transition group/nav"
              >
                Next: {steps[idx + 1].icon} {steps[idx + 1].title}
                <span className="text-blue-400 group-hover/nav:translate-x-1 transition-transform">↓</span>
              </a>
            ) : (
              <div className="border-t border-slate-100 px-6 py-3 text-center text-sm font-medium text-green-600 bg-green-50/50">
                ✅ You've completed the guide! Start sending SMS.
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Quick Reference */}
      <div className="bg-slate-800 rounded-2xl p-8 text-white">
        <h2 className="text-xl font-bold mb-4">⚡ Quick Reference</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {steps.map((step) => (
            <a
              key={step.number}
              href={step.action?.href || "#"}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-lg px-4 py-3 text-sm transition group"
            >
              <span className="text-lg">{step.icon}</span>
              <span className="text-blue-200 group-hover:text-white">{step.title}</span>
              {step.videoUrl && <span className="text-red-400 text-xs ml-auto">🎥</span>}
            </a>
          ))}
        </div>
      </div>

      {/* Footer help */}
      <div className="text-center pb-8">
        <p className="text-slate-400 text-sm">
          Need help?{" "}
          <Link href="/dashboard/support-tickets" className="text-blue-600 hover:underline font-medium">
            Create a Support Ticket
          </Link>{" "}
          or visit{" "}
          <a href="https://net2app.com/resources" className="text-blue-600 hover:underline font-medium">
            Resources Hub
          </a>
        </p>
      </div>
    </div>
  );
}
