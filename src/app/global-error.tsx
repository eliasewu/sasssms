"use client";

import { useEffect } from "react";
import "./globals.css";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error boundary for the root layout.
 *
 * Replaces Next.js's auto-generated /_global-error page which crashes during
 * static prerendering in development mode (NODE_ENV=development) with:
 *   TypeError: Cannot read properties of null (reading 'useContext')
 *
 * Must be a "use client" component and must include its own <html>/<body>
 * tags because it replaces the root layout entirely on error.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <head>
        <title>Error — Net2APP</title>
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              An unexpected error occurred. Please try again.
            </p>
            <button
              onClick={reset}
              className="px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition shadow-sm"
            >
              Try Again
            </button>
            <p className="mt-6 text-xs text-gray-400">
              Net2APP — SMS Gateway Platform
            </p>
          </div>
        </div>
      </body>
    </html>
  );
}
