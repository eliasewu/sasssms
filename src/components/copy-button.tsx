"use client";

import { useState, useRef } from "react";

/** Copies `value` to clipboard on click. Shows 📋 → ✅ for 1.5s. */
export default function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleCopy = () => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs text-blue-500 hover:text-blue-700 transition-colors inline-flex items-center min-w-[72px]"
      title={copied ? "Copied!" : "Copy to clipboard"}
    >
      {copied ? <><span className="mr-1">✅</span>Copied!</> : <><span className="mr-1">📋</span>Copy</>}
    </button>
  );
}
