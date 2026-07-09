import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Solutions for Healthcare — Appointment Reminders & Patient Alerts | Net2APP",
  description: "Appointment reminders, prescription fill alerts, patient notifications, and test result communications for healthcare providers with Voice OTP for patient identity verification.",
  keywords: [
    "Healthcare SMS",
    "Medical SMS",
    "Patient Notification SMS",
    "Appointment Reminder SMS",
    "Prescription Alert SMS",
    "Patient Verification SMS",
    "HIPAA SMS",
    "Clinic SMS",
    "Hospital SMS Notification",
    "Healthcare SMS Bangladesh",
    "Medical SMS India",
    "Healthcare SMS UAE",
    "Patient Engagement SMS",
    "Medical Practice SMS",
    "Healthcare Messaging",
  ],
  openGraph: { title: "Healthcare SMS — Appointment Reminders & Alerts | Net2APP", description: "SMS and Voice OTP solutions for healthcare providers and medical practices." },
};

const features = ["Automated appointment reminders", "Prescription and refill alerts", "Patient notification broadcasts", "Voice OTP for patient verification", "Multi-language patient messaging"];


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/industries/healthcare#webpage",
        "url": "https://net2app.com/solutions/industries/healthcare",
        "name": "SMS Solutions for Healthcare — Appointment Reminders & Patient Alerts",
        "description": "Appointment reminders, prescription fill alerts, patient notifications, and test result communications for healthcare providers.",
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
              "name": "Industries",
              "item": "https://net2app.com/solutions/industries"
            },
            {
              "@type": "ListItem",
              "position": 4,
              "name": "Healthcare",
              "item": "https://net2app.com/solutions/industries/healthcare"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/industries/healthcare#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How do appointment reminders reduce no-shows?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Businesses using Net2APP SMS appointment reminders typically see a 30-50% reduction in no-show rates. Automated reminders at configurable intervals (72h, 24h, 2h before) provide multiple touchpoints. Include rescheduling links and clinic contact information for a complete patient communication workflow."
            }
          },
          {
            "@type": "Question",
            "name": "Is Net2APP suitable for handling protected health information (PHI)?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Net2APP's PostgreSQL schema isolation ensures complete data separation between tenants — no shared tables or data. Combined with IP whitelisting, API key rotation, audit logging, and encrypted SMPP connections, the platform provides the technical controls needed for healthcare data protection. Each facility or clinic can have its own isolated schema."
            }
          },
          {
            "@type": "Question",
            "name": "Can I send lab results and prescription notifications via SMS?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Send secure SMS notifications when lab results are ready or prescriptions need to be picked up. Use templated messages with patient-specific information. For sensitive content, redirect patients to a secure portal with a link rather than including details in the SMS body."
            }
          },
          {
            "@type": "Question",
            "name": "How does multi-language support work for diverse patient populations?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Net2APP's Voice OTP engine automatically detects the recipient's country via MCC and delivers spoken OTP messages in the local language across 220+ countries. For SMS, you can create message templates in multiple languages and select the appropriate template based on patient language preferences stored in your EHR system."
            }
          }
        ]
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://net2app.com/solutions/industries/healthcare#app",
        "name": "Net2APP Healthcare SMS Solution",
        "url": "https://net2app.com/solutions/industries/healthcare",
        "description": "HIPAA-ready SMS communications for healthcare providers. Appointment reminders, lab result notifications, prescription alerts, and patient engagement via SMS, Voice OTP, and WhatsApp.",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free to start with pay-as-you-go pricing. Healthcare-grade data isolation included."
        },
        "featureList": [
          "Automated appointment reminders with configurable schedules",
          "Voice OTP for patient identity verification and consent",
          "Lab result and prescription ready notifications via SMS",
          "WhatsApp messaging for rich patient communications",
          "PostgreSQL schema isolation for PHI data separation",
          "IP whitelisting and API key rotation for access security",
          "DLR tracking for delivery confirmation of critical alerts",
          "Multi-language SMS support for diverse patient populations",
          "Audit logging for HIPAA compliance documentation",
          "Sub-client isolation for multi-facility healthcare networks"
        ]
      }
    ]
  };

export default function HealthcarePage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200"><div className="max-w-7xl mx-auto px-6 lg:px-8"><div className="flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">N</div><span className="text-xl font-bold text-gray-900 tracking-tight">Net2APP</span></Link>
          <div className="hidden lg:flex items-center gap-1">
            <Link href="/solutions/industries" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Industries</Link>
          </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://net2app.com" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started</a>
      </div></div></nav>
      <section className="max-w-6xl mx-auto px-6 lg:px-12 pt-16 pb-20">
        <div className="flex items-center gap-3 mb-4"><Link href="/solutions/industries" className="text-blue-600 hover:text-blue-700 font-medium text-sm transition">← Back to Industries</Link></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-6xl mb-4 block">🏥</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">Healthcare</h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">Appointment reminders, prescription fill alerts, patient notifications, and test result communications. Healthcare providers use Net2APP's reliable SMS delivery and Voice OTP for patient identity verification.</p>
            <a href="https://net2app.com" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">Deploy Your Instance →</a>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-gray-900 font-semibold text-lg mb-4">Key Features</h2>
            <ul className="space-y-3">{features.map((f, i) => (<li key={i} className="flex items-start gap-2 text-gray-600"><span className="text-green-500 mt-0.5 shrink-0">✓</span><span>{f}</span></li>))}</ul>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Improve Patient Engagement</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy healthcare SMS in under 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
        </div>
      </section>
      
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <footer className="py-12 bg-gray-900 border-t border-gray-800"><div className="max-w-7xl mx-auto px-6 lg:px-12"><div className="flex flex-col md:flex-row items-center justify-between gap-4"><Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div><span className="text-white font-semibold text-lg">Net2APP</span></Link><p className="text-blue-400 text-sm text-center">Enterprise SMS Gateway & Voice OTP Platform</p><div className="flex items-center gap-4 flex-wrap justify-center"><Link href="/solutions" className="text-blue-400 hover:text-white text-sm transition">Solutions</Link><Link href="/solutions/industries" className="text-blue-400 hover:text-white text-sm transition">Industries</Link><Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link></div></div><div className="mt-8 pt-8 border-t border-gray-800 text-center"><p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p></div></div></footer>
    </div>
  );
}
