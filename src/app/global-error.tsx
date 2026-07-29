"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">🍌</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            Database Unavailable
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            We can&apos;t reach the database right now. Please try again in a
            moment.
          </p>
          <button
            onClick={reset}
            className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold text-sm"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
