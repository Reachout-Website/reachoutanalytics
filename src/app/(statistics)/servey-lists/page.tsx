import React from "react";
import { ServeyLists } from "../components/ServeyLists";

export default function ServeyListsPage() {
  return (
    <main className="min-h-screen px-4 py-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Servey Lists</h1>
            <p className="text-sm text-gray-600">
              View and manage all your available serveys.
            </p>
          </div>
        </header>
        <ServeyLists />
      </div>
    </main>
  );
}
