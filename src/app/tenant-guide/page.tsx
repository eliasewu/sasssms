"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import guideData from "./guide-data.json";

type Block =
  | { t: "p"; text: string }
  | { t: "sub"; text: string }
  | { t: "tips"; title?: string; items: string[] }
  | { t: "callout"; title?: string; items: string[] }
  | { t: "howto"; title: string }
  | { t: "bullets"; items: string[] }
  | { t: "cta"; label: string }
  | { t: "steps"; items: string[] }
  | { t: "glossary"; rows: [string, string][] }
  | { t: "quiz"; items: { q: string; a: string }[] }
  | { t: "essays"; items: { title: string; prompt: string }[] };

type Section = { id: string; title: string; icon: string; blocks: Block[] };
type Chapter = {
  id: string;
  title: string;
  icon: string;
  desc: string;
  sections: Section[];
};

const data = guideData as { title: string; subtitle: string; chapters: Chapter[] };

function BoldLabel({ text }: { text: string }) {
  // Render "Label: rest" with the label in bold (used inside callout / bullet lines)
  const idx = text.indexOf(":");
  if (idx > 0 && idx < 60) {
    return (
      <>
        <span className="font-semibold text-gray-900">{text.slice(0, idx)}</span>
        {text.slice(idx)}
      </>
    );
  }
  return <>{text}</>;
}

function BlockRenderer({ block }: { block: Block }) {
  switch (block.t) {
    case "p":
      return <p className="text-gray-600 text-sm leading-relaxed">{block.text}</p>;
    case "sub":
      return (
        <h4 className="text-base font-semibold text-gray-900 pt-2 first:pt-0">
          {block.text}
        </h4>
      );
    case "tips":
      return (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">
            💡 {block.title || "Tips"}
          </p>
          <ul className="space-y-1.5">
            {block.items.map((item, i) => (
              <li key={i} className="text-sm text-amber-900 leading-relaxed flex gap-2">
                <span className="text-amber-500 shrink-0">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "callout":
      return (
        <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-4">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">
            {block.title || "How it works"}
          </p>
          <ul className="space-y-1.5">
            {block.items.map((item, i) => (
              <li key={i} className="text-sm text-gray-700 leading-relaxed flex gap-2">
                <span className="text-blue-500 shrink-0">•</span>
                <span><BoldLabel text={item} /></span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "howto":
      // The guide's "How to X" lines are section labels — render as a highlighted heading.
      return (
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900">
          ▶ {block.title}
        </div>
      );
    case "bullets":
      return (
        <ul className="space-y-1.5">
          {block.items.map((item, i) => (
            <li key={i} className="text-sm text-gray-600 leading-relaxed flex gap-2">
              <svg className="w-4 h-4 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="space-y-1.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5 text-sm text-gray-700 leading-relaxed">
              <span className="shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="font-medium text-gray-800">{item.replace(/^\d+\.\s*/, "")}</span>
            </li>
          ))}
        </ol>
      );
    case "cta":
      return (
        <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-blue-600 text-white text-xs font-semibold shadow-sm">
          {block.label} →
        </span>
      );
    case "glossary":
      return (
        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2.5 font-semibold text-gray-900 w-2/5 border-b border-gray-200">Term</th>
                <th className="px-4 py-2.5 font-semibold text-gray-900 border-b border-gray-200">Definition</th>
              </tr>
            </thead>
            <tbody>
              {block.rows.map(([term, def], i) => (
                <tr key={i} className={i % 2 ? "bg-gray-50/50" : "bg-white"}>
                  <td className="px-4 py-2.5 font-medium text-gray-900 border-t border-gray-100 align-top">{term}</td>
                  <td className="px-4 py-2.5 text-gray-600 border-t border-gray-100 align-top">{def}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "quiz":
      return (
        <div className="space-y-3">
          {block.items.map((item, i) => (
            <details key={i} className="rounded-xl bg-white border border-gray-200 shadow-sm group open:border-blue-500/50 transition">
              <summary className="px-4 py-3 cursor-pointer list-none flex items-start justify-between gap-3 text-sm font-semibold text-gray-900">
                <span className="flex gap-2">
                  <span className="shrink-0 text-blue-600 font-bold">Q{i + 1}.</span>
                  <span>{item.q}</span>
                </span>
                <span className="text-blue-400 text-base group-open:rotate-180 transition-transform shrink-0">▼</span>
              </summary>
              <div className="px-4 py-3 border-t border-gray-100">
                <p className="text-sm text-gray-600 leading-relaxed">
                  <span className="font-semibold text-green-600 mr-1">A:</span>
                  {item.a}
                </p>
              </div>
            </details>
          ))}
        </div>
      );
    case "essays":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {block.items.map((item, i) => (
            <div key={i} className="rounded-xl bg-white border border-gray-200 p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition">
              <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1.5">Essay {i + 1}</div>
              <h4 className="text-gray-900 font-semibold text-sm mb-1">{item.title}</h4>
              {item.prompt && <p className="text-gray-500 text-sm leading-relaxed">{item.prompt}</p>}
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

function SectionCard({ section, chapterId }: { section: Section; chapterId: string }) {
  return (
    <div id={`${chapterId}-${section.id}`} className="scroll-mt-28 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 lg:p-7">
      <div className="flex items-center gap-3 mb-4">
        {section.icon && <span className="text-2xl shrink-0">{section.icon}</span>}
        <h3 className="text-lg lg:text-xl font-bold text-gray-900">{section.title}</h3>
      </div>
      <div className="space-y-3.5">
        {section.blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </div>
    </div>
  );
}

export default function TenantGuidePage() {
  const [activeId, setActiveId] = useState<string>("");
  const [showMobileToc, setShowMobileToc] = useState(false);
  const [query, setQuery] = useState("");
  const [progress, setProgress] = useState(0);
  const mainRef = useRef<HTMLDivElement | null>(null);

  const flatSections = useMemo(() => {
    const out: { chapterId: string; chapterTitle: string; section: Section }[] = [];
    data.chapters.forEach((ch) =>
      ch.sections.forEach((s) => out.push({ chapterId: ch.id, chapterTitle: ch.title, section: s }))
    );
    return out;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const blockMatches = (b: Block): boolean => {
      if ("text" in b) return b.text.toLowerCase().includes(q);
      if ("items" in b) {
        return (b as { items: unknown[] }).items.some((it) =>
          typeof it === "string" ? it.toLowerCase().includes(q) : JSON.stringify(it).toLowerCase().includes(q)
        );
      }
      if ("rows" in b) return JSON.stringify((b as { rows: unknown[] }).rows).toLowerCase().includes(q);
      return false;
    };
    return flatSections.filter(({ section }) =>
      section.title.toLowerCase().includes(q) || section.blocks.some(blockMatches)
    );
  }, [query, flatSections]);

  // Reading progress + scroll spy (position-based so the last section always activates)
  useEffect(() => {
    const ids = flatSections.map(({ chapterId, section }) => `${chapterId}-${section.id}`);
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const el = mainRef.current;
        if (!el) return;
        const total = el.scrollHeight - window.innerHeight;
        setProgress(total > 0 ? Math.min(100, (window.scrollY / total) * 100) : 0);
        // last section whose top has passed the sticky header
        let current = ids[0] || "";
        for (const id of ids) {
          const node = document.getElementById(id);
          if (node && node.getBoundingClientRect().top <= 150) current = id;
        }
        setActiveId(current);
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [flatSections]);

  const jumpTo = (id: string) => {
    setShowMobileToc(false);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const totalSections = flatSections.length;

  return (
    <div className="min-h-screen bg-white" ref={mainRef}>
      {/* Reading progress bar */}
      <div className="fixed top-0 left-0 z-[60] h-1 bg-gradient-to-r from-blue-500 to-indigo-500 transition-[width] duration-150"
        style={{ width: `${progress}%` }} />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">N</div>
              <span className="text-xl font-bold text-gray-900 tracking-tight">Net2APP</span>
            </Link>
            <div className="hidden lg:flex items-center gap-1">
              <Link href="/" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Home</Link>
              <Link href="/pricing" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Pricing</Link>
              <Link href="/resources" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">Resources</Link>
              <Link href="/api-documentation" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition">API Docs</Link>
            </div>
            <div className="flex items-center gap-3">
              <a href="https://net2app.com" className="hidden sm:inline-flex px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm">Get Started Free</a>
              <button onClick={() => setShowMobileToc(!showMobileToc)} className="lg:hidden p-2 text-gray-600 hover:text-gray-900">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showMobileToc ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                </svg>
              </button>
            </div>
          </div>
        </div>
        {/* Mobile TOC drawer */}
        {showMobileToc && (
          <div className="lg:hidden max-h-[70vh] overflow-y-auto border-t border-gray-200 bg-white shadow-xl">
            <div className="px-6 py-4 space-y-1">
              {data.chapters.map((ch) => (
                <div key={ch.id} className="mb-3">
                  <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1.5">{ch.icon} {ch.title}</p>
                  {ch.sections.map((s) => (
                    <button key={s.id} onClick={() => jumpTo(`${ch.id}-${s.id}`)}
                      className="block w-full text-left px-3 py-1.5 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                      {s.icon} {s.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 rounded-full px-4 py-1.5 mb-6">
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
              <span className="text-blue-200 text-sm font-medium">📘 Tenant User Guide</span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-tight mb-6">
              Net2APP Tenant User Guide
              <span className="block text-blue-400 text-2xl lg:text-3xl font-bold mt-3">Everything you need to operate your SMS gateway</span>
            </h1>
            <p className="text-lg text-blue-200 max-w-3xl mx-auto leading-relaxed">
              {data.subtitle}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              {[
                { n: data.chapters.length, label: "Chapters" },
                { n: totalSections, label: "Sections" },
                { n: "100+", label: "Guided Steps" },
                { n: "Free", label: "For All Tenants" },
              ].map((s) => (
                <span key={s.label} className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm">
                  <strong className="text-white">{s.n}</strong>
                  <span className="text-blue-200">{s.label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Layout: TOC sidebar + content */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[290px_1fr] gap-10">
          {/* Sidebar TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">Search the guide</label>
                <div className="relative">
                  <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. SMPP, routes, DLR…"
                    className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition"
                  />
                </div>
              </div>

              {filtered ? (
                <div className="max-h-[60vh] overflow-y-auto space-y-0.5 pr-1">
                  {filtered.length === 0 && <p className="text-sm text-gray-400 px-2">No matches found.</p>}
                  {filtered.map(({ chapterId, section }) => (
                    <button key={section.id} onClick={() => jumpTo(`${chapterId}-${section.id}`)}
                      className={`block w-full text-left px-3 py-1.5 rounded-lg text-sm transition ${
                        activeId === `${chapterId}-${section.id}` ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                      }`}>
                      {section.icon} {section.title}
                    </button>
                  ))}
                </div>
              ) : (
                <nav className="max-h-[62vh] overflow-y-auto pr-1 space-y-4">
                  {data.chapters.map((ch) => (
                    <div key={ch.id}>
                      <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1.5">{ch.icon} {ch.title}</p>
                      <div className="space-y-0.5">
                        {ch.sections.map((s) => (
                          <button key={s.id} onClick={() => jumpTo(`${ch.id}-${s.id}`)}
                            className={`block w-full text-left px-3 py-1.5 rounded-lg text-[13px] transition ${
                              activeId === `${ch.id}-${s.id}` ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-600 hover:text-blue-600 hover:bg-blue-50"
                            }`}>
                            {s.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </nav>
              )}
            </div>
          </aside>

          {/* Content */}
          <div className="space-y-10">
            {filtered ? (
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900">Search results ({filtered.length})</h2>
                  <button onClick={() => setQuery("")} className="text-sm text-blue-600 hover:underline">Clear search</button>
                </div>
                {filtered.map(({ chapterId, section }) => (
                  <SectionCard key={section.id} section={section} chapterId={chapterId} />
                ))}
              </div>
            ) : (
              data.chapters.map((ch) => (
                <section key={ch.id} className="space-y-5">
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-3xl">{ch.icon}</span>
                    <div>
                      <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">{ch.title}</h2>
                      <p className="text-sm text-gray-500 mt-0.5">{ch.desc}</p>
                    </div>
                  </div>
                  <div className="space-y-5">
                    {ch.sections.map((s) => (
                      <SectionCard key={s.id} section={s} chapterId={ch.id} />
                    ))}
                  </div>
                </section>
              ))
            )}

            {/* Bottom CTA */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-8 text-center shadow-xl mt-4">
              <h3 className="text-2xl font-bold text-white mb-2">Ready to put the guide into practice?</h3>
              <p className="text-blue-100 mb-6 max-w-2xl mx-auto">Deploy your own SMS gateway in under 60 seconds and explore every feature documented here.</p>
              <div className="flex flex-wrap justify-center gap-3">
                <a href="https://net2app.com" className="px-8 py-3 bg-white text-blue-700 rounded-xl hover:bg-blue-50 transition font-bold shadow-lg">Deploy Free Now →</a>
                <Link href="/resources" className="px-8 py-3 border-2 border-white/30 text-white rounded-xl hover:bg-white/10 transition font-bold">Browse the Knowledge Base</Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-12 bg-gray-900 border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div>
              <span className="text-white font-semibold text-lg">Net2APP</span>
            </Link>
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <Link href="/pricing" className="text-blue-400 hover:text-white text-sm transition">Pricing</Link>
              <Link href="/resources" className="text-blue-400 hover:text-white text-sm transition">Resources</Link>
              <Link href="/tenant-guide" className="text-white text-sm font-medium">Tenant Guide</Link>
              <Link href="/api-documentation" className="text-blue-400 hover:text-white text-sm transition">API Docs</Link>
              <Link href="/case-studies" className="text-blue-400 hover:text-white text-sm transition">Case Studies</Link>
              <Link href="/contact" className="text-blue-400 hover:text-white text-sm transition">Contact</Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center">
            <p className="text-gray-500 text-sm">© {new Date().getFullYear()} Tri Angle Trade Centre FZE LLC. All Rights Reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
