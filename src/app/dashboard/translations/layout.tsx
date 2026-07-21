"use client";

import { useState, useEffect, createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { padMnc } from "@/lib/mcc-lookup-client";

// ── MCC/MNC tree node types ──
interface OperatorNode {
  mcc: string;
  mnc: string;
  networkName: string;
  networkType: string;
}

interface CountryNode {
  countryCode: string;
  countryName: string;
  operators: OperatorNode[];
}

// ── Selection context: { mcc, mnc } or null for "All" ──
interface MccMncSelection {
  mcc: string | null;
  mnc: string | null;
  label: string; // display label like "Bangladesh / GP" or "All Operators"
}

const MccMncContext = createContext<{
  selection: MccMncSelection;
  setSelection: (s: MccMncSelection) => void;
}>({
  selection: { mcc: null, mnc: null, label: "All Operators" },
  setSelection: () => {},
});

export function useMccMnc() {
  return useContext(MccMncContext);
}

// ── Translation type config ──
const translationTypes = [
  { href: "/dashboard/translations/sid", label: "SID Translation", icon: "📱", desc: "Change sender ID per operator" },
  { href: "/dashboard/translations/number", label: "Number Translation", icon: "🔢", desc: "Transform destination numbers" },
  { href: "/dashboard/translations/content", label: "Content Translation", icon: "📝", desc: "Find & replace in SMS body" },
  { href: "/dashboard/translations/random", label: "Random Content", icon: "🎲", desc: "Randomize content per operator" },
  { href: "/dashboard/translations/otp-extract", label: "OTP Extract & Forward", icon: "🔐", desc: "Extract OTP from inbox, forward to supplier" },
];

export default function TranslationsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [countries, setCountries] = useState<CountryNode[]>([]);
  const [search, setSearch] = useState("");
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<MccMncSelection>({
    mcc: null, mnc: null, label: "All Operators",
  });
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    fetch("/api/tenant/mccmnc")
      .then(r => r.json())
      .then(d => setCountries(d.countries || []))
      .catch(() => {});
  }, []);

  const filtered = countries.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.countryName.toLowerCase().includes(q) ||
      c.operators.some(o => o.networkName.toLowerCase().includes(q) || o.mcc.includes(q) || o.mnc.includes(q))
    );
  });

  const toggleCountry = (name: string) => {
    setExpandedCountries(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectOperator = (country: CountryNode, op: OperatorNode) => {
    setSelection({ mcc: op.mcc, mnc: op.mnc, label: `${country.countryName} / ${op.networkName}` });
  };

  const selectAll = () => {
    setSelection({ mcc: null, mnc: null, label: "All Operators" });
  };

  // ── Find current page info ──
  const currentType = translationTypes.find(t => pathname.startsWith(t.href));

  return (
    <MccMncContext.Provider value={{ selection, setSelection }}>
      <div className="flex gap-0 min-h-[calc(100vh-160px)]">
        {/* ── MCC/MNC Tree Panel ── */}
        <div className={`${collapsed ? "w-12" : "w-64"} bg-white border-r border-slate-200 shrink-0 transition-all duration-300 flex flex-col`}>
          <div className="p-3 border-b border-slate-200 flex items-center justify-between shrink-0">
            {!collapsed && <h3 className="font-semibold text-sm text-slate-700">🌍 Operators</h3>}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-slate-400 hover:text-slate-600 text-xs px-1.5 py-0.5 rounded hover:bg-slate-100"
              title={collapsed ? "Expand" : "Collapse"}
            >
              {collapsed ? "▶" : "◀"}
            </button>
          </div>

          {!collapsed && (
            <>
              {/* Search */}
              <div className="p-2 shrink-0">
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search country or operator..."
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Tree */}
              <div className="flex-1 overflow-y-auto">
                {/* All Operators */}
                <button
                  onClick={selectAll}
                  className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                    selection.mcc === null
                      ? "bg-blue-50 text-blue-700 border-l-2 border-blue-500"
                      : "hover:bg-slate-50 text-slate-600 border-l-2 border-transparent"
                  }`}
                >
                  🌐 All Operators
                </button>

                {filtered.map(country => {
                  const isExpanded = expandedCountries.has(country.countryName) || !!search;
                  const flag = country.countryCode ? String.fromCodePoint(
                    ...country.countryCode.toUpperCase().split("").map((c: string) => 0x1F1E6 + c.charCodeAt(0) - 65)
                  ) : "🌍";

                  return (
                    <div key={country.countryName}>
                      <button
                        onClick={() => toggleCountry(country.countryName)}
                        className="w-full text-left px-3 py-1.5 flex items-center gap-2 text-xs font-medium hover:bg-slate-50 text-slate-700 transition-colors"
                      >
                        <span className="text-[10px]">{isExpanded ? "▼" : "▶"}</span>
                        <span>{flag}</span>
                        <span className="truncate">{country.countryName}</span>
                        <span className="text-slate-400 ml-auto text-[10px]">{country.operators.length}</span>
                      </button>

                      {isExpanded && country.operators.map(op => {
                        const isSelected = selection.mcc === op.mcc && selection.mnc === op.mnc;
                        return (
                          <button
                            key={`${op.mcc}-${op.mnc}`}
                            onClick={() => selectOperator(country, op)}
                            className={`w-full text-left pl-8 pr-3 py-1.5 text-xs transition-colors ${
                              isSelected
                                ? "bg-blue-50 text-blue-700 border-l-2 border-blue-500"
                                : "hover:bg-slate-50 text-slate-500 border-l-2 border-transparent"
                            }`}
                          >
                            <div className="truncate">{op.networkName}</div>
                            <div className="text-[10px] text-slate-400">MCC:{op.mcc}/MNC:{padMnc(op.mnc)}</div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}

                {filtered.length === 0 && search && (
                  <p className="text-xs text-slate-400 text-center py-4">No operators found</p>
                )}
              </div>

              {/* Selection badge */}
              <div className="p-2 border-t border-slate-200 shrink-0">
                <div className="bg-slate-50 rounded-lg px-3 py-2 text-[10px] text-slate-500">
                  <span className="font-medium text-slate-700">Selected:</span>{" "}
                  {selection.label}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Main Content Area ── */}
        <div className="flex-1 min-w-0">
          {/* Translation type tabs */}
          <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center gap-1 overflow-x-auto shrink-0">
            {translationTypes.map(t => {
              const isActive = pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span>{t.icon}</span>
                  <span className="hidden sm:inline">{t.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Page content */}
          <div className="p-6">
            {currentType && (
              <div className="mb-4">
                <h2 className="text-lg font-bold text-slate-800">{currentType.icon} {currentType.label}</h2>
                <p className="text-xs text-slate-500">{currentType.desc}</p>
              </div>
            )}
            {children}
          </div>
        </div>
      </div>
    </MccMncContext.Provider>
  );
}
