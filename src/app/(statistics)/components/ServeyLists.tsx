"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UploadSurveyModal } from "./UploadSurveyModal";

type Servey = {
  id: string;
  name: string;
  description: string;
  responses: number;
  updatedAt: string;
};

export function ServeyLists() {
  const router = useRouter();
  const [serveys, setServeys] = useState<Servey[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServeys = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/survey/list");
      if (!response.ok) {
        throw new Error("Failed to fetch surveys");
      }
      const data = await response.json();
      setServeys(data.surveys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load surveys");
      console.error("Error fetching surveys:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchServeys();
  }, []);

  const handleUploadSuccess = () => {
    fetchServeys(); // Refresh the list after successful upload
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Available Serveys</h2>
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          Upload Servey
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-600">Loading surveys...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : serveys.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-600">No surveys available. Upload your first survey to get started.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {serveys.map((servey) => (
            <article
              key={servey.id}
              onClick={() => router.push(`/analysis?surveyId=${servey.id}`)}
              className="flex flex-col justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="space-y-1.5">
                <h3 className="text-gray-800 font-semibold">{servey.name}</h3>
                <p className="text-sm text-gray-600 line-clamp-3">
                  {servey.description}
                </p>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                <span>{servey.responses} responses</span>
                <span>Updated {servey.updatedAt}</span>
              </div>
            </article>
          ))}
        </div>
      )}

      <UploadSurveyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUploadSuccess={handleUploadSuccess}
      />
    </section>
  );
}
