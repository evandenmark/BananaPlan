"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isDbError =
    error.message?.includes("ENOTFOUND") ||
    error.message?.includes("Failed query") ||
    error.message?.includes("connect ECONNREFUSED") ||
    error.message?.includes("not found");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">🍌</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">
          {isDbError ? "Database Unavailable" : "Something went wrong"}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {isDbError
            ? "We can't reach the database right now. This is usually temporary — please try again in a moment."
            : "An unexpected error occurred. Please try again."}
        </p>
        <button
          onClick={reset}
          className="w-full bg-green-700 text-white py-3 rounded-xl font-semibold text-sm"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
