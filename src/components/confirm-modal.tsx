"use client";

import { useState, useCallback } from "react";

interface ConfirmState {
  isOpen: boolean;
  message: string;
  resolve: (value: boolean) => void;
}

/**
 * useConfirmModal — drop-in replacement for window.confirm()
 *
 * Usage:
 *   const { confirm, modal } = useConfirmModal();
 *   if (!await confirm("Are you sure?")) return;
 *   ... do delete ...
 *   {modal}
 */
export function useConfirmModal() {
  const [state, setState] = useState<ConfirmState | null>(null);

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ isOpen: true, message, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  const modal = state ? (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleCancel}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">⚠️</span>
          <h3 className="font-semibold text-lg">Confirm</h3>
        </div>
        <p className="text-sm text-slate-600 mb-6">{state.message}</p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleCancel}
            className="border border-slate-300 px-5 py-2 rounded-lg text-sm hover:bg-slate-50 transition font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-red-700 transition font-medium"
          >
            {state.message.toLowerCase().includes("archive") ? "Archive" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, modal };
}
