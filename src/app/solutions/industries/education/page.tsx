import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS Solutions for Education — Attendance Alerts & Campus Broadcasts | Net2APP",
  description: "Attendance alerts, grade notifications, emergency campus broadcasts, parent-teacher communication, and admission updates for educational institutions.",
  keywords: [
    "Education SMS",
    "School SMS",
    "Attendance Alert SMS",
    "Grade Notification SMS",
    "Campus Broadcast SMS",
    "Parent-Teacher SMS",
    "University SMS",
    "Student Notification SMS",
    "Education SMS Bangladesh",
    "School SMS India",
    "Education SMS UAE",
    "Campus Alert SMS",
    "Academic SMS",
    "Education SMS Platform",
  ],
  openGraph: { title: "Education SMS — Attendance Alerts & Campus Broadcasts | Net2APP", description: "SMS solutions for education: attendance, grades, emergency alerts, and parent-teacher communication." },
};

const features = ["Attendance alert SMS", "Grade and report notifications", "Emergency campus broadcasts", "Parent-teacher communication", "Admission status updates"];


const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://net2app.com/solutions/industries/education#webpage",
        "url": "https://net2app.com/solutions/industries/education",
        "name": "SMS Solutions for Education — Attendance Alerts & Campus Notifications",
        "description": "Attendance alerts, grade notifications, emergency campus broadcasts, and parent-teacher communication for educational institutions.",
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
              "name": "Education",
              "item": "https://net2app.com/solutions/industries/education"
            }
          ]
        }
      },
      {
        "@type": "FAQPage",
        "@id": "https://net2app.com/solutions/industries/education#faq",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "How can schools use SMS for parent communications?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Send automated attendance alerts when a student is marked absent, broadcast exam schedules and results, send fee payment reminders with due dates, and distribute emergency alerts for school closures. Two-way SMS enables parents to reply and communicate with teachers directly."
            }
          },
          {
            "@type": "Question",
            "name": "Can I send different messages to different grade levels?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Segment your contact lists by grade level, class, or student group. Each segment receives only relevant communications — exam schedules for their grade, field trip reminders for their class, or club announcements for their group. Net2APP's list management makes segmentation simple."
            }
          },
          {
            "@type": "Question",
            "name": "How does emergency broadcast SMS work?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Send Flash SMS messages that appear directly on phone screens for urgent school closures, weather emergencies, or security alerts. Combine SMS broadcasts with WhatsApp messages for multi-channel emergency communication. Messages are delivered instantly with delivery tracking to confirm receipt."
            }
          },
          {
            "@type": "Question",
            "name": "Can I manage communications across multiple school campuses?",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": "Yes. Net2APP's sub-client architecture lets you create isolated environments for each campus or school in your network. Each campus gets its own API keys, sender IDs, contact lists, and message templates — enabling campus-specific communications while using a single centralized platform."
            }
          }
        ]
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://net2app.com/solutions/industries/education#app",
        "name": "Net2APP Education SMS Solution",
        "url": "https://net2app.com/solutions/industries/education",
        "description": "Education SMS platform for attendance alerts, exam notifications, fee reminders, parent-teacher communications, and emergency broadcasts for schools, colleges, and universities.",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "All",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free to start with pay-as-you-go pricing. Education-grade communication tools included."
        },
        "featureList": [
          "Attendance alert SMS for parents and guardians",
          "Exam schedule and result notification broadcasts",
          "Fee payment reminders with due date alerts",
          "Emergency broadcast SMS for school closures and alerts",
          "Parent-teacher communication via two-way SMS",
          "WhatsApp messaging for rich school announcements",
          "Bulk SMS for event invitations and newsletter distribution",
          "Voice OTP for parent identity verification",
          "Multi-language support for diverse school communities",
          "Sub-client isolation for multi-campus education networks"
        ]
      }
    ]
  };

export default function EducationPage() {
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
            <span className="text-6xl mb-4 block">🎓</span>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">Education</h1>
            <p className="text-lg text-gray-600 leading-relaxed mb-6">Attendance alerts, grade notifications, emergency campus broadcasts, parent-teacher communication, and admission updates. Educational institutions keep students and parents informed with automated SMS.</p>
            <a href="https://net2app.com" className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition font-semibold shadow-sm">Deploy Your Instance →</a>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-8 shadow-sm">
            <h2 className="text-gray-900 font-semibold text-lg mb-4">Key Features</h2>
            <ul className="space-y-3">{features.map((f, i) => (<li key={i} className="flex items-start gap-2 text-gray-600"><span className="text-green-500 mt-0.5 shrink-0">✓</span><span>{f}</span></li>))}</ul>
          </div>
        </div>
      </section>
      <section className="py-20 bg-gradient-to-r from-violet-600 to-purple-600">
        <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Connect Your Campus</h2>
          <p className="text-blue-100 text-lg mb-8">Deploy education SMS in under 60 seconds.</p>
          <a href="https://net2app.com" className="inline-block px-10 py-4 bg-white text-violet-600 rounded-xl hover:bg-blue-50 transition font-semibold text-lg shadow-xl">Deploy Your Instance Free →</a>
        </div>
      </section>
      
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <footer className="py-12 bg-gray-900 border-t border-gray-800"><div className="max-w-7xl mx-auto px-6 lg:px-12"><div className="flex flex-col md:flex-row items-center justify-between gap-4"><Link href="/" className="flex items-center gap-2.5 shrink-0"><div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div><span className="text-white font-semibold text-lg">Net2APP</span></Link><p className="text-blue-400 text-sm text-center">Enterprise SMS Gateway & Voice OTP Platform</p><div className="flex items-center gap-4 flex-wrap justify-center"><Link href="/solutions" className="text-blue-400 hover:text-white text-sm transition">Solutions</Link><Link href="/solutions/industries" className="text-blue-400 hover:text-white text-sm transition">Industries</Link><Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link></div></div><div className="mt-8 pt-8 border-t border-gray-800 text-center"><p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p></div></div></footer>
    </div>
  );
}
