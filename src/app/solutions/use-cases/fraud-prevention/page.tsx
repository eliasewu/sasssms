import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fraud Prevention — Real-Time SMS, Flash SMS & Voice Alerts | Net2APP",
  description:
    "Send real-time fraud alerts and suspicious activity notifications via SMS, Flash SMS (priority screen pop-up), and Voice OTP. IP whitelisting for API security ensures only authorized users can trigger communications.",
  keywords: [
    "Fraud Prevention SMS",
    "Fraud Alert SMS",
    "SMS Fraud Detection",
    "Flash SMS Fraud Alert",
    "Real-Time Fraud Notification",
    "Voice OTP Fraud Prevention",
    "Suspicious Activity Alerts",
    "Transaction Alert SMS",
    "Banking Fraud Alert",
    "SMS Security Alert",
    "Fraud Monitoring SMS",
    "Anti-Fraud SMS",
    "Security SMS Gateway",
    "Fraud Prevention Bangladesh",
    "Fraud Alert India",
    "Fraud SMS UAE",
    "SMS Fraud Detection API",
    "Fraud Notification Platform",
  ],
  openGraph: {
    title: "Fraud Prevention — SMS & Voice Fraud Alerts | Net2APP",
    description: "Real-time fraud alerts via SMS, Flash SMS, and Voice OTP with API IP whitelisting for security.",
  },
};


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/use-cases/fraud-prevention#webpage",
        "url": "https://net2app.com/solutions/use-cases/fraud-prevention",
        "name": "Fraud Prevention — Real-Time SMS, Flash SMS & Voice Alerts",
        "description": "Send real-time fraud alerts and suspicious activity notifications via SMS, Flash SMS, and Voice OTP with API IP whitelisting for security.",
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
              "name": "Fraud Prevention",
              "item": "https://net2app.com/solutions/use-cases/fraud-prevention"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/use-cases/fraud-prevention#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How does SMS fraud prevention work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Net2APP sends real-time fraud alerts via SMS, Flash SMS, and Voice OTP when suspicious activity is detected. Flash SMS messages appear as instant screen pop-ups for immediate visibility, while Voice OTP provides an additional verification layer for high-risk transactions."
            }
          },
          {
            "@type": "Question",
            "name": "Can fraud alerts be sent to multiple channels simultaneously?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. You can configure fraud alerts to be sent via SMS, Flash SMS, and Voice OTP simultaneously. Each channel triggers independently through the Net2APP API, ensuring the alert is received regardless of the user's device state."
            }
          },
          {
            "@type": "Question",
            "name": "Is IP whitelisting required for fraud alert APIs?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "IP whitelisting is strongly recommended but optional. It ensures only authorized servers can trigger fraud alerts, preventing unauthorized use of the alert system. Configure IP whitelisting per API key from the dashboard."
            }
          }
        ]
      }
    ]
  };

export default function FraudPreventionPage() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200"><div className="max-w-7xl mx-auto px-6 lg:px-8"><div className="flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">N</div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">Net2APP</span>
        </Link>
          <div className="hidden lg:flex items-center gap-1">
            <Link href="/solutions/use-cases" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Use Cases</Link>
          </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="https://net2app.com" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started</a>
      </div></div></nav>

      <section className="max-w-6xl mx-auto px-6 lg:px-12 pt-16 pb-20">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/solutions/use-cases" className="text-blue-600 hover:text-blue-700 font-medium text-sm transition">← Back to Use Cases</Link>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-6xl mb-4 block">🛡️</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">Fraud Prevention</h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">
              Send real-time fraud alerts and suspicious activity notifications via SMS, Flash SMS (priority screen pop-up),
              and Voice OTP. IP whitelisting for API security ensures only authorized users can trigger communications.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="https://net2app.com" className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">Deploy Your Instance →</a>
              <Link href="/ip-whitelisting" className="px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition font-semibold">Learn About IP Whitelisting</Link>
            </div>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-gray-900 font-semibold text-lg mb-4">Key Capabilities</h2>
            <ul className="space-y-3">
              {["Real-time fraud alert SMS", "Flash SMS for urgent notifications", "Voice OTP for high-risk transactions", "IP whitelisting for API security", "Multi-factor authentication support"].map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-gray-600"><span className="text-green-500 mt-0.5 shrink-0">✓</span><span>{f}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-20 bg-gradient-to-r from-blue-600 to-indigo-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Protect Your Business</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy fraud prevention alerts in under 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
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
