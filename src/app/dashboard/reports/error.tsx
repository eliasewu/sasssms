"use client";

export default function ReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="text-4xl mb-4">📊</div>
        <h2 className="text-lg font-semibold text-slate-800 mb-1">
          Failed to Load Reports
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          {error.message || "An unexpected error occurred while fetching report data."}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
