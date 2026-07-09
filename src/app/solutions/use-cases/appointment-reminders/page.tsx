import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Appointment Reminders — SMS & WhatsApp Automated Scheduling | Net2APP",
  description: "Reduce no-shows with automated SMS appointment reminders. Send confirmations, reminders, rescheduling links, and follow-up messages for healthcare, hospitality, and service businesses.",
  keywords: [
    "SMS Appointment Reminders",
    "Appointment SMS",
    "SMS Scheduling",
    "Automated SMS Reminder",
    "No-Show Reduction SMS",
    "Healthcare SMS Reminder",
    "Patient Appointment SMS",
    "Two-Way SMS Confirmation",
    "Calendar Integration SMS",
    "Multi-Language Reminders",
    "Rescheduling SMS",
    "Appointment Reminder Bangladesh",
    "Clinic SMS Reminder",
    "SMS Reminder India",
    "Booking SMS",
    "Appointment SMS API",
    "Dental SMS Reminder",
    "Salon SMS Reminder",
  ],
  openGraph: { title: "Appointment Reminders — SMS Reminder System | Net2APP", description: "Automated SMS appointment reminders, confirmations, and rescheduling to reduce no-shows." },
};


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/use-cases/appointment-reminders#webpage",
        "url": "https://net2app.com/solutions/use-cases/appointment-reminders",
        "name": "Appointment Reminders — SMS & WhatsApp Automated Scheduling",
        "description": "Reduce no-shows with automated SMS appointment reminders. Send confirmations, reminders, rescheduling links, and follow-up messages.",
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
              "name": "Appointment Reminders",
              "item": "https://net2app.com/solutions/use-cases/appointment-reminders"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/use-cases/appointment-reminders#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How much can automated SMS reminders reduce no-shows?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Businesses using Net2APP SMS appointment reminders typically see a 30-50% reduction in no-show rates. Automated reminders at 72h, 24h, and 2h before appointments provide multiple touchpoints that significantly improve attendance."
            }
          },
          {
            "@type": "Question",
            "name": "Can patients confirm or reschedule via SMS?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Net2APP supports two-way SMS so patients can reply to confirm (e.g., 'YES') or request rescheduling. These responses can be integrated with your calendar or booking system via webhooks."
            }
          },
          {
            "@type": "Question",
            "name": "Does the system support multiple languages?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Net2APP supports Unicode messaging for multi-language reminders. Configure reminder templates in English, Spanish, Arabic, Bengali, Hindi, and other languages with automatic character encoding."
            }
          }
        ]
      }
    ]
  };

export default function AppointmentRemindersPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200"><div className="max-w-7xl mx-auto px-6 lg:px-8"><div className="flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">N</div><span className="text-xl font-bold text-gray-900 tracking-tight">Net2APP</span></Link>
          <div className="hidden lg:flex items-center gap-1">
            <Link href="/solutions/use-cases" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Use Cases</Link>
          </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://net2app.com" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started</a>
      </div></div></nav>
      <section className="max-w-6xl mx-auto px-6 lg:px-12 pt-16 pb-20">
        <div className="flex items-center gap-3 mb-4"><Link href="/solutions/use-cases" className="text-blue-600 hover:text-blue-700 font-medium text-sm transition">← Back to Use Cases</Link></div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-6xl mb-4 block">📅</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">Appointment Reminders</h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">Reduce no-shows with automated SMS appointment reminders. Send confirmations, reminders, rescheduling links, and follow-up messages. Suitable for healthcare, hospitality, and service businesses.</p>
            <a href="https://net2app.com" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">Deploy Your Instance →</a>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-gray-900 font-semibold text-lg mb-4">Key Capabilities</h2>
            <ul className="space-y-3">{["Automated reminder scheduling", "Two-way SMS confirmation", "Calendar integration support", "Multi-language reminders", "Analytics and delivery tracking"].map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-600"><span className="text-green-500 mt-0.5 shrink-0">✓</span><span>{f}</span></li>
            ))}</ul>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-r from-teal-600 to-cyan-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Reduce No-Shows Today</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy automated reminders in under 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-teal-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
        </div>
      </section>
      <footer className="py-12 bg-gray-900 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div><span className="text-white font-semibold text-lg">Net2APP</span></Link>
            <p className="text-blue-400 text-sm text-center">Enterprise SMS Gateway & Voice OTP Platform</p>
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <Link href="/solutions" className="text-blue-400 hover:text-white text-sm transition">Solutions</Link>
              <Link href="/solutions/use-cases" className="text-blue-400 hover:text-white text-sm transition">Use Cases</Link>
              <Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center"><p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p></div>
        </div>
      
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </footer>
    </div>
  );
}
