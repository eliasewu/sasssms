import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Solutions by Industry — Financial, Healthcare, Retail, Ecommerce & More | Net2APP",
  description:
    "Net2APP SMS gateway solutions for financial services, healthcare, retail, nonprofit, hospitality, ecommerce, public sector, and education. Industry-specific features including Voice OTP, RCS, Flash SMS, and WhatsApp API.",
  keywords: [
    "SMS Industries",
    "Industry SMS Solution",
    "Financial Services SMS",
    "Healthcare SMS Solution",
    "Retail SMS Solution",
    "Ecommerce SMS Solution",
    "Education SMS Solution",
    "Nonprofit SMS Solution",
    "SMS Industry Bangladesh",
    "SMS Industry India",
    "SMS Industry UAE",
    "Vertical SMS Solution",
    "Industry-Specific SMS",
    "SMS by Industry",
  ],
  openGraph: {
    title: "SMS Gateway Solutions by Industry | Net2APP",
    description: "Industry-specific SMS solutions for financial services, healthcare, retail, ecommerce, education, and more.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebPage",
      "@id": "https://net2app.com/solutions/industries#webpage",
      "url": "https://net2app.com/solutions/industries",
      "name": "SMS Solutions by Industry — Financial, Healthcare, Retail & More",
      "description":
        "Net2APP SMS gateway solutions for financial services, healthcare, retail, nonprofit, hospitality, ecommerce, public sector, and education.",
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://net2app.com" },
          { "@type": "ListItem", "position": 2, "name": "Solutions", "item": "https://net2app.com/solutions" },
          { "@type": "ListItem", "position": 3, "name": "Industries", "item": "https://net2app.com/solutions/industries" },
        ],
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://net2app.com/solutions/industries#faq",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Do you offer industry-specific compliance features?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Net2APP provides industry-specific SMS solutions that address compliance requirements. Financial services benefit from IP whitelisting and audit logging for transaction alerts. Healthcare solutions support HIPAA-compliant messaging patterns for patient notifications. All industries can configure message retention, encryption, and access controls per tenant.",
          },
        },
        {
          "@type": "Question",
          "name": "Can I customize SMS solutions for my specific industry?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Absolutely. Net2APP's multi-tenant architecture lets you configure custom routing rules, message templates, sender IDs, and DLR tracking per industry vertical. Each tenant gets an isolated PostgreSQL schema, so you can tailor the platform to Healthcare, Financial Services, Retail, or any other sector without cross-contamination.",
          },
        },
        {
          "@type": "Question",
          "name": "How do you handle different compliance regulations across industries?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Net2APP's multi-tenant isolation ensures each industry tenant has independent data storage, access controls, and message routing. You can configure message retention policies, audit logging, IP whitelisting, and API key management per tenant. The platform supports GDPR, TCPA, and regional telecom regulations through configurable compliance settings.",
          },
        },
        {
          "@type": "Question",
          "name": "Do you have pre-built solutions for specific industries?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes. Net2APP includes pre-configured SMS routing templates, message templates, and connector configurations for Financial Services, Healthcare, Retail, Ecommerce, Nonprofit, Hospitality, Public Sector, and Education. Each industry page details the specific features, compliance considerations, and integration patterns for that sector.",
          },
        },
      ],
    },
  ],
};


const industrySections = [
  {
    id: "financial",
    icon: "🏦",
    title: "Financial Services",
    href: "/solutions/industries/financial-services",
    gradient: "from-amber-50 to-yellow-50",
    desc: "Secure transaction alerts, Voice OTP for banking authentication, fraud detection notifications, and regulatory compliance messaging.",
  },
  {
    id: "healthcare",
    icon: "🏥",
    title: "Healthcare",
    href: "/solutions/industries/healthcare",
    gradient: "from-blue-50 to-cyan-50",
    desc: "Appointment reminders, prescription fill alerts, patient notifications, and test result communications for healthcare providers.",
  },
  {
    id: "retail",
    icon: "🛍️",
    title: "Retail",
    href: "/solutions/industries/retail",
    gradient: "from-pink-50 to-rose-50",
    desc: "Promotional SMS campaigns, order updates, loyalty program communications, and personalized shopping experiences.",
  },
  {
    id: "nonprofit",
    icon: "🤝",
    title: "Nonprofit",
    href: "/solutions/industries/nonprofit",
    gradient: "from-green-50 to-emerald-50",
    desc: "Donation campaign SMS, volunteer coordination, event notifications, and impact updates for nonprofit organizations.",
  },
  {
    id: "hospitality",
    icon: "🏨",
    title: "Hospitality",
    href: "/solutions/industries/hospitality",
    gradient: "from-teal-50 to-cyan-50",
    desc: "Booking confirmations, check-in reminders, guest feedback surveys, and concierge SMS services.",
  },
  {
    id: "ecommerce",
    icon: "🛒",
    title: "Ecommerce",
    href: "/solutions/industries/ecommerce",
    gradient: "from-indigo-50 to-purple-50",
    desc: "Order confirmations, shipping updates, cart abandonment recovery, and personalized product recommendations.",
  },
  {
    id: "public-sector",
    icon: "🏛️",
    title: "Public Sector",
    href: "/solutions/industries/public-sector",
    gradient: "from-slate-50 to-gray-50",
    desc: "Emergency alerts, citizen notifications, public service updates, and government communications.",
  },
  {
    id: "education",
    icon: "🎓",
    title: "Education",
    href: "/solutions/industries/education",
    gradient: "from-violet-50 to-purple-50",
    desc: "Attendance alerts, grade notifications, emergency campus broadcasts, and parent-teacher communication.",
  },
];

export default function IndustriesPage() {
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
              <Link href="/solutions/teams" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Teams</Link>
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
            Solutions by Industry
            <span className="block text-blue-600">Tailored for Your Sector</span>
          </h1>
          <p className="text-lg text-gray-600 max-w-4xl mx-auto">
            Net2APP provides industry-specific SMS, Voice OTP, RCS, and OTT messaging solutions for 8 major industries —
            from financial services and healthcare to retail, ecommerce, and education.
          </p>
        </div>
      </section>

      {/* Industry Sections */}
      <section className="max-w-7xl mx-auto px-6 lg:px-12 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {industrySections.map((ind) => (
            <Link key={ind.id} href={ind.href} className={`bg-gradient-to-br ${ind.gradient} rounded-2xl p-8 border border-gray-100 hover:shadow-md hover:border-gray-200 transition group`}>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">{ind.icon}</span>
                <h2 className="text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition">{ind.title}</h2>
              </div>
              <p className="text-gray-600 leading-relaxed mb-4">{ind.desc}</p>
              <span className="inline-flex items-center gap-1 text-blue-600 group-hover:text-blue-700 font-medium text-sm transition">
                View Industry Page <span className="text-lg">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">See Your Industry Solution</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy your industry-specific SMS gateway in under 60 seconds. No setup fees. Pay only for messages sent.</p>
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
                <Link href="/solutions/teams" className="block text-sm text-gray-400 hover:text-white transition">Teams</Link>
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
