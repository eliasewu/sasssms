"use client";

import type { ReactNode } from "react";

// ──────────────────────────────────────────────────────────
// SkeletonTable — animated skeleton rows for table loading
// ──────────────────────────────────────────────────────────
export function SkeletonTable({ cols = 5, rows = 8, className = "" }: { cols?: number; rows?: number; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden animate-pulse ${className}`}>
      <div className="h-10 bg-slate-50 border-b" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 px-4 py-3 border-b last:border-0">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-4 bg-slate-100 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// SkeletonCardGrid — animated skeleton cards for card grids
// ──────────────────────────────────────────────────────────
export function SkeletonCardGrid({ count = 3, cols = "md:grid-cols-3", className = "" }: { count?: number; cols?: string; className?: string }) {
  return (
    <div className={`grid grid-cols-1 ${cols} gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border-2 border-slate-200 p-5 animate-pulse">
          <div className="h-8 w-8 bg-slate-200 rounded mb-3" />
          <div className="h-5 bg-slate-200 rounded w-28 mb-2" />
          <div className="h-3 bg-slate-100 rounded w-full mb-3" />
          <div className="h-8 bg-slate-200 rounded w-24 mb-3" />
          <div className="space-y-1.5">
            <div className="h-3 bg-slate-100 rounded w-full" />
            <div className="h-3 bg-slate-100 rounded w-3/4" />
            <div className="h-3 bg-slate-100 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// SkeletonStatBar — animated stat cards
// ──────────────────────────────────────────────────────────
export function SkeletonStatBar({ count = 4, cols = "md:grid-cols-4" }: { count?: number; cols?: string }) {
  return (
    <div className={`grid grid-cols-2 ${cols} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border p-4 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-24 mb-3" />
          <div className="h-8 bg-slate-200 rounded w-32 mb-2" />
          <div className="h-3 bg-slate-100 rounded w-40" />
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// EmptyState — consistent "no data" message
// ──────────────────────────────────────────────────────────
export function EmptyState({
  icon = "📭",
  title = "Nothing here yet",
  description,
  action,
}: {
  icon?: string;
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border p-12 text-center">
      <p className="text-3xl mb-3">{icon}</p>
      <p className="text-lg font-medium text-slate-700 mb-1">{title}</p>
      {description && <p className="text-sm text-slate-400 max-w-md mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// ErrorState — consistent error display with retry
// ──────────────────────────────────────────────────────────
export function ErrorState({
  message = "Failed to load data. Please check your connection.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-2xl">⚠️</span>
        <p className="text-sm text-red-700">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// LoadingWrapper — orchestrates loading → error → empty states
// ──────────────────────────────────────────────────────────
interface LoadingWrapperProps {
  loading: boolean;
  error?: string | null;
  isEmpty: boolean;
  emptyState?: ReactNode;
  errorState?: ReactNode;
  loadingState?: ReactNode;
  children: ReactNode;
}

export function LoadingWrapper({
  loading,
  error,
  isEmpty,
  emptyState,
  errorState,
  loadingState,
  children,
}: LoadingWrapperProps) {
  if (error) {
    return <>{errorState || <ErrorState message={error} />}</>;
  }

  if (loading) {
    return <>{loadingState || <SkeletonTable />}</>;
  }

  if (isEmpty) {
    return <>{emptyState || <EmptyState />}</>;
  }

  return <>{children}</>;
}
