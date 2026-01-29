import Link from "next/link";
import React from "react";

export default function MainPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-3xl font-bold">Reachout Analytics</h1>
      <p className="text-gray-600 text-center max-w-md">
        Welcome to your dashboard. View and manage your surveys from here.
      </p>
      <Link
        href="/servey-lists"
        className="inline-flex items-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        Go to Servey Lists
      </Link>
      <Link
        href="/reports"
        className="inline-flex items-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        Go to Reports
      </Link>
    </main>
  );
}
