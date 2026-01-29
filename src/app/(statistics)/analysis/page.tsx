import React, { Suspense } from "react";
import { Analysis } from "../components/Analysis";

function AnalysisLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-gray-600">Loading...</p>
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense fallback={<AnalysisLoading />}>
      <Analysis />
    </Suspense>
  );
}
