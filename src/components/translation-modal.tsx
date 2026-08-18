"use client";

import { ReactNode } from "react";

/**
 * Shared modal shell for all translation rule editors.
 * Renders the overlay + header + footer (Preview / Test / Cancel / Update),
 * while each page supplies the form body as children.
 */
export default function TranslationModal({
  title,
  onClose,
  children,
  onPreview,
  onTest,
  onSave,
  saving = false,
  saveLabel = "Update",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  onPreview?: () => void;
  onTest?: () => void;
  onSave: () => void;
  saving?: boolean;
  saveLabel?: string;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-2xl shadow-xl mt-6 mb-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">{children}</div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onPreview && (
              <button
                onClick={onPreview}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-700 transition"
              >
                👁 Preview
              </button>
            )}
            {onTest && (
              <button
                onClick={onTest}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-sm font-medium text-slate-700 transition"
              >
                ▶ Test
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold transition"
            >
              {saving ? "Saving..." : saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
