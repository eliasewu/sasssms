import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Solutions by Team — Developers, Marketing, Product, CX & Data Engineering | Net2APP",
  description:
    "Net2APP SMS gateway tools for every team: RESTful API and SMPP for developers, campaign management for marketing, Voice OTP for product teams, omnichannel engagement for CX, and data pipelines for data engineering.",
  keywords: [
    "SMS Teams",
    "Developer SMS",
    "Marketing SMS Team",
    "Product SMS Team",
    "Data Engineering SMS",
    "Customer Experience SMS",
    "Team SMS Solution",
    "Department SMS",
    "SMS for Teams Bangladesh",
    "SMS Team India",
    "SMS Team UAE",
    "Cross-Functional SMS",
    "Team SMS Platform",
    "SMS for Business Teams",
  ],
  openGraph: {
    title: "SMS Gateway Solutions by Team | Net2APP",
    description: "Net2APP provides tailored SMS tools for developers, marketers, product managers, CX teams, and data engineers.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/solutions/teams#webpage",
      "url": "https://net2app.com/solutions/teams",
      "name": "SMS Solutions by Team — Developers, Marketing, Product & More",
      "description":
        "Net2APP SMS gateway tools for every team: RESTful API and SMPP for developers, campaign management for marketing, Voice OTP for product teams, omnichannel engagement for CX, and data pipelines for data engineering.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "Solutions", "item": "https://net2app.com/solutions" },
          { "@type": "ListItem", "position": 3, "name": "Teams", "item": "https://net2app.com/solutions/teams" },
        ],
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://net2app.com/solutions/teams#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Can different teams share the same SMS platform?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Net2APP's multi-tenant architecture allows different teams (Developers, Marketing, Product, CX, Data Engineering) to use the same platform with role-based access control. Each team gets appropriate permissions: developers access APIs and webhooks, marketers access campaign tools, and data engineers access data pipelines and analytics.",
          },
        },
        {
          "@type": "Question",
          "name": "How do developers and marketers collaborate on the platform?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Developers set up the SMS infrastructure — APIs, SMPP connections, webhook endpoints, and IP whitelisting. Marketers then use these configured channels to create campaigns, segment audiences, and run analytics without needing to write code. The RBAC system ensures each team sees only what they need while sharing the same underlying SMS infrastructure.",
          },
        },
        {
          "@type": "Question",
          "name": "Can I restrict what each team member can access?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Net2APP includes role-based access control (RBAC) with configurable roles and permissions. You can create custom roles per team — developers get API and SMPP access, marketers get campaign tools, product teams get Voice OTP configuration, and CX teams get the unified inbox. Sub-clients can also have team-specific access controls.",
          },
        },
        {
          "@type": "Question",
          "name": "How do data engineers access SMS analytics data?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Data engineers can stream DLR data via webhooks, export message logs in CSV/JSON format, access MCC traffic statistics, and integrate with BI tools through database-level access. Net2APP supports custom analytics pipelines with real-time data export for building internal dashboards and reports.",
          },
        },
      ],
    },
  ],
};

const teamSections = [
  {
    id: "developers",
    icon: "💻",
    title: "For Developers",
    subtitle: "RESTful API, SMPP v3.4, Webhooks & SDKs",
    href: "/solutions/teams/developers",
    desc: "Net2APP provides a developer-first SMS platform with clean RESTful APIs, full SMPP v3.4 protocol support, and webhook-based DLR callbacks. Integrate SMS, Voice OTP, RCS, WhatsApp, and Telegram into any application with minimal code.",
    features: ["RESTful HTTP API with API key + IP whitelist auth", "SMPP v3.4 gateway with transmitter/receiver/transceiver binds", "DLR webhook callbacks for real-time delivery status", "Voice OTP API with Asterisk AMI integration", "WhatsApp & Telegram Business API via Baileys & MTProto", "Rate limiting, TPS control, and message queuing"],
  },
  {
    id: "data-engineering",
    icon: "📊",
    title: "For Data Engineering",
    subtitle: "SMS Data Pipelines, DLR Analytics & Export",
    href: "/solutions/teams/data-engineering",
    desc: "Build data pipelines around your SMS infrastructure. Stream message logs, DLR reports, and analytics data into your data warehouse, BI tools, and custom dashboards. Export message data in real-time or batch.",
    features: ["Real-time DLR data streaming via webhooks", "Message log export (CSV, JSON)", "MCC traffic statistics per client", "Database-level access to message data", "Custom analytics integration support"],
  },
  {
    id: "marketing",
    icon: "📣",
    title: "For Marketing",
    subtitle: "Campaign Management, RCS & Audience Segmentation",
    href: "/solutions/teams/marketing",
    desc: "Run SMS marketing campaigns with powerful segmentation, personalization, and analytics. Use RCS rich messaging for branded campaigns with images and interactive buttons. Flash SMS for urgent promotions.",
    features: ["Bulk SMS campaign management", "RCS rich media messaging (images, carousels, buttons)", "Audience segmentation and list management", "Personalized message templates", "Campaign performance analytics", "A/B testing and optimization"],
  },
  {
    id: "product",
    icon: "🎯",
    title: "For Product Teams",
    subtitle: "Voice OTP, In-App Messaging & API-First Design",
    href: "/solutions/teams/product",
    desc: "Add communication features to your product with a single API integration. SMS, Voice OTP, WhatsApp, and Telegram — all through one platform. Net2APP's multi-tenant architecture means each customer gets isolated data.",
    features: ["Single API for SMS, Voice, WhatsApp, Telegram", "Multi-tenant architecture with data isolation", "Voice OTP for user verification flows", "White-label branding support", "Scalable from prototype to enterprise"],
  },
  {
    id: "cx",
    icon: "❤️",
    title: "For Customer Experience",
    subtitle: "Omnichannel Engagement, Automation & Personalization",
    href: "/solutions/teams/customer-experience",
    desc: "Deliver seamless customer experiences across SMS, Voice OTP, WhatsApp, and Telegram. Automate engagement journeys, send personalized messages, and collect feedback — all from a single platform.",
    features: ["Omnichannel customer engagement", "Automated communication journeys", "Personalized message delivery", "Real-time feedback collection", "Customer satisfaction surveys", "Multi-language support"],
  },
];

export default function TeamsPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">N</div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">Net2APP</span>
            </Link>
            <div className="hidden lg:flex items-center gap-1">
              <Link href="/solutions" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Solutions</Link>
              <Link href="/solutions/use-cases" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Use Cases</Link>
              <Link href="/solutions/industries" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Industries</Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/contact" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-50 to-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 pt-16 pb-12 text-center">
          <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            Solutions by Team
            <span className="block text-blue-600">Tools for Every Department</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-4xl mx-auto">
            Net2APP provides tailored tools and APIs for every team in your organization — from developers integrating APIs
            to marketers running campaigns and CX teams engaging customers.
          </p>
        </div>
      </section>

      {/* Team Sections */}
      {teamSections.map((team, i) => (
        <Link key={team.id} href={team.href} className={`block py-16 ${i % 2 === 1 ? 'bg-gray-50' : ''} hover:bg-gray-50/50 transition group`}>
          <div className="max-w-6xl mx-auto px-6 lg:px-12">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-3">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-4xl">{team.icon}</span>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition">{team.title}</h2>
                    <p className="text-gray-500 text-sm">{team.subtitle}</p>
                  </div>
                </div>
                <p className="text-gray-600 leading-relaxed mb-4">{team.desc}</p>
                <span className="inline-block text-blue-600 group-hover:text-blue-700 font-medium text-sm transition">View page →</span>
              </div>
              <div className="lg:col-span-2">
                <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6">
                  <h3 className="text-gray-900 font-semibold text-sm mb-3">Key Features</h3>
                  <ul className="space-y-2">
                    {team.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2 text-gray-600 text-sm">
                        <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </Link>
      ))}

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">What Team Will You Empower?</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy your SMS gateway in under 60 seconds. No setup fees. Pay only for messages sent.</p>
          <Link href="/contact" className="inline-block px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</Link>
        </div>
      </section>

      {/* Footer */}
      
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <footer className="bg-gray-900 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div>
                <span className="text-white font-semibold text-lg">Net2APP</span>
              </Link>
              <p className="text-gray-400 text-sm max-w-md leading-relaxed">Enterprise SMS Gateway & Voice OTP Platform. Multi-tenant SaaS with SMPP, HTTP API, RCS, Voice OTP, and OTT messaging.</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Solutions</p>
              <div className="space-y-2.5">
                <Link href="/solutions" className="block text-sm text-gray-400 hover:text-white transition">Overview</Link>
                <Link href="/solutions/use-cases" className="block text-sm text-gray-400 hover:text-white transition">Use Cases</Link>
                <Link href="/solutions/industries" className="block text-sm text-gray-400 hover:text-white transition">Industries</Link>
              </div>
            </div>
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">Company</p>
              <div className="space-y-2.5">
                <Link href="/contact" className="block text-sm text-gray-400 hover:text-white transition">Contact</Link>
                <Link href="/solutions/startup" className="block text-sm text-gray-400 hover:text-white transition">Startup</Link>
                <Link href="/solutions/enterprise" className="block text-sm text-gray-400 hover:text-white transition">Enterprise</Link>
              </div>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-center">
            <p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
