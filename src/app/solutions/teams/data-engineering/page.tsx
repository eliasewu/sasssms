import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Data Engineering — SMS Data Pipelines & DLR Analytics | Net2APP",
  description: "Build data pipelines around your SMS infrastructure. Stream message logs, DLR reports, and analytics data into your data warehouse, BI tools, and custom dashboards.",
  keywords: [
    "SMS Data Engineering",
    "SMS Data Pipeline",
    "DLR Analytics",
    "SMS Data Export",
    "SMS Message Logs",
    "SMS Analytics Pipeline",
    "SMS Data Infrastructure",
    "Real-Time SMS Data",
    "SMS Reporting",
    "SMS BI Integration",
    "SMS Data Warehouse",
    "Data Engineering SMS Bangladesh",
    "SMS Analytics India",
    "SMS Data UAE",
    "SMS Log Analysis",
    "SMS Data Platform",
  ],
  openGraph: { title: "Data Engineering — SMS Data Pipelines & Analytics | Net2APP", description: "SMS data pipelines, DLR streaming, and analytics export for your data infrastructure." },
};


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/teams/data-engineering#webpage",
        "url": "https://net2app.com/solutions/teams/data-engineering",
        "name": "For Data Engineering — SMS Data Pipelines & DLR Analytics",
        "description": "Build data pipelines around your SMS infrastructure. Stream message logs, DLR reports, and analytics data into your data warehouse.",
        "breadcrumb": {
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://net2app.com"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Solutions",
              "item": "https://net2app.com/solutions"
            },
            {
              "@type": "ListItem",
              "position": 3,
              "name": "Teams",
              "item": "https://net2app.com/solutions/teams"
            },
            {
              "@type": "ListItem",
              "position": 4,
              "name": "Data Engineering",
              "item": "https://net2app.com/solutions/teams/data-engineering"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/teams/data-engineering#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How does PostgreSQL schema isolation work for data engineering?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Each tenant gets a completely isolated PostgreSQL schema — not just row-level separation. This means all tables, data, and indexes are separated at the database level. Data engineers can query tenant-specific schemas without worrying about cross-tenant data leakage, making it ideal for compliance-heavy industries."
            }
          },
          {
            "@type": "Question",
            "name": "What delivery report data is available?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Net2APP provides detailed DLR data including delivery status (delivered/failed/pending/expired), timestamps, carrier information, error codes, message latency, and TPS throughput. All DLR data is accessible via the dashboard, API, and webhook callbacks for integration with external analytics platforms."
            }
          },
          {
            "@type": "Question",
            "name": "Can I export SMS data to my own data warehouse?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Use webhook callbacks to stream DLR data in real-time to your data warehouse or analytics platform. The REST API also supports batch export of message logs, billing records, and delivery statistics. All data is available in JSON format for easy ingestion into any data pipeline."
            }
          },
          {
            "@type": "Question",
            "name": "How does the multi-tenant billing system work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Each tenant and sub-client has its own billing profile with configurable per-SMS rates, monthly fees, and credit packages. The system automatically tracks message volume, calculates charges, and generates invoices. Billing data is stored in the tenant's isolated schema for complete data separation."
            }
          }
        ]
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://net2app.com/solutions/teams/data-engineering#app",
        "name": "Net2APP SMS Data Platform",
        "url": "https://net2app.com/solutions/teams/data-engineering",
        "description": "Data engineering platform for SMS analytics, delivery reporting, and message pipeline management. PostgreSQL schema isolation ensures clean data separation for multi-tenant analytics.",
        "applicationCategory": "DeveloperApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free to start with pay-as-you-go pricing. Built-in data pipeline infrastructure."
        },
        "featureList": [
          "Real-time DLR delivery reports and analytics dashboards",
          "PostgreSQL schema isolation for clean multi-tenant data",
          "Message pipeline management with queuing and TPS control",
          "Automated billing and invoice generation per tenant",
          "SMPP bind status monitoring and performance metrics",
          "Webhook-based data export to external analytics platforms",
          "Per-tenant data isolation with no shared tables",
          "Sub-client data partitioning with individual reporting",
          "Rate limiting and throughput analytics per API key",
          "Audit logging for compliance and security monitoring"
        ]
      }
    ]
  };

export default function DataEngineeringPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200"><div className="max-w-7xl mx-auto px-6 lg:px-8"><div className="flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">N</div><span className="text-xl font-bold text-gray-900 tracking-tight">Net2APP</span></Link>
          <div className="hidden lg:flex items-center gap-1">
            <Link href="/solutions/teams" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Teams</Link>
          </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://net2app.com" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started</a>
      </div></div></nav>
      <section className="max-w-6xl mx-auto px-6 lg:px-12 pt-16 pb-20">
        <div className="flex items-center gap-3 mb-4"><Link href="/solutions/teams" className="text-blue-600 hover:text-blue-700 font-medium text-sm transition">← Back to Teams</Link></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-6xl mb-4 block">📊</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">For Data Engineering</h1>
            <p className="text-gray-500 text-sm font-medium mb-2">SMS Data Pipelines, DLR Analytics & Export</p>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">Build data pipelines around your SMS infrastructure. Stream message logs, DLR reports, and analytics data into your data warehouse, BI tools, and custom dashboards. Export message data in real-time or batch.</p>
            <a href="https://net2app.com" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">Deploy Your Instance →</a>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-gray-900 font-semibold text-lg mb-4">Key Features</h2>
            <ul className="space-y-3">{["Real-time DLR data streaming via webhooks", "Message log export (CSV, JSON)", "MCC traffic statistics per client", "Database-level access to message data", "Custom analytics integration support"].map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-600"><span className="text-green-500 mt-0.5 shrink-0">✓</span><span>{f}</span></li>
            ))}</ul>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-r from-cyan-600 to-blue-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Pipe Your SMS Data</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy your SMS data pipeline in under 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-cyan-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
        </div>
      </section>
      
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <footer className="py-12 bg-gray-900 border-t border-gray-800"><div className="max-w-7xl mx-auto px-6 lg:px-12"><div className="flex flex-col md:flex-row items-center justify-between gap-4"><Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div><span className="text-white font-semibold text-lg">Net2APP</span></Link><p className="text-blue-400 text-sm text-center">Enterprise SMS Gateway & Voice OTP Platform</p><div className="flex items-center gap-4 flex-wrap justify-center"><Link href="/solutions" className="text-blue-400 hover:text-white text-sm transition">Solutions</Link><Link href="/solutions/teams" className="text-blue-400 hover:text-white text-sm transition">Teams</Link><Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link></div></div><div className="mt-8 pt-8 border-t border-gray-800 text-center"><p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p></div></div></footer>
    </div>
  );
}
