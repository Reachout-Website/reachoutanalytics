"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

type PlotlyData = Record<string, any>;
type PlotlyLayout = Record<string, any>;

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
  loading: () => (
    <div className="h-64 flex items-center justify-center text-gray-400">
      Loading chart...
    </div>
  ),
}) as any;

type AnalysisType =
  | "Calculated Measure (KPI)"
  | "Ranking"
  | "Breakdown (geo spatial)"
  | "Breakdown"
  | "Overview"
  | "Trend Over Time"
  | "Comparison"
  | "Relative Importance"
  | "Ranking (grouped)"
  | "Year to Date"
  | "Process Control (rolling mean)"
  | "Process Control (mean)"
  | "Correlation"
  | "Mutual Information"
  | "Clustering (k-means)"
  | "Anomaly (spike)"
  | "Anomaly (trend)"
  | "Period over Period"
  | "Period Changes"
  | "Period Changes (detailed)"
  | "Period over Period (selected)"
  | "Trend with Forecast"
  | "Time Series Decomposition";

type AnalysisConfig = {
  id: string;
  type: AnalysisType;
  fields: string[];
  result?: any;
};

type SurveyData = {
  id: string;
  title: string;
  variablesList: string[];
  data: Record<string, any>[];
  numVariables: number;
  numInstances: number;
};

// Analysis type requirements
const ANALYSIS_REQUIREMENTS: Record<AnalysisType, { min: number; max: number; description: string }> = {
  "Calculated Measure (KPI)": { min: 1, max: 5, description: "Select 1-5 numeric fields" },
  "Ranking": { min: 1, max: 1, description: "Select 1 field to rank" },
  "Breakdown (geo spatial)": { min: 1, max: 2, description: "Select 1-2 fields (1 geo field recommended)" },
  "Breakdown": { min: 1, max: 3, description: "Select 1-3 fields" },
  "Overview": { min: 0, max: 0, description: "No fields required - shows dataset overview" },
  "Trend Over Time": { min: 1, max: 2, description: "Select 1-2 fields (1 time field recommended)" },
  "Comparison": { min: 2, max: 4, description: "Select 2-4 fields" },
  "Relative Importance": { min: 2, max: 5, description: "Select 2-5 fields" },
  "Ranking (grouped)": { min: 2, max: 3, description: "Select 2-3 fields" },
  "Year to Date": { min: 1, max: 2, description: "Select 1-2 fields (1 date field recommended)" },
  "Process Control (rolling mean)": { min: 1, max: 2, description: "Select 1-2 numeric fields" },
  "Process Control (mean)": { min: 1, max: 2, description: "Select 1-2 numeric fields" },
  "Correlation": { min: 2, max: 10, description: "Select 2-10 numeric fields" },
  "Mutual Information": { min: 2, max: 10, description: "Select 2-10 fields" },
  "Clustering (k-means)": { min: 2, max: 10, description: "Select 2-10 numeric fields" },
  "Anomaly (spike)": { min: 1, max: 2, description: "Select 1-2 numeric fields" },
  "Anomaly (trend)": { min: 1, max: 2, description: "Select 1-2 numeric fields" },
  "Period over Period": { min: 1, max: 2, description: "Select 1-2 fields" },
  "Period Changes": { min: 1, max: 2, description: "Select 1-2 fields" },
  "Period Changes (detailed)": { min: 1, max: 3, description: "Select 1-3 fields" },
  "Period over Period (selected)": { min: 2, max: 3, description: "Select 2-3 fields" },
  "Trend with Forecast": { min: 1, max: 2, description: "Select 1-2 fields (1 time field recommended)" },
  "Time Series Decomposition": { min: 1, max: 2, description: "Select 1-2 fields (1 time field recommended)" },
};

const ANALYSIS_TYPES: AnalysisType[] = [
  "Calculated Measure (KPI)",
  "Ranking",
  "Breakdown (geo spatial)",
  "Breakdown",
  "Overview",
  "Trend Over Time",
  "Comparison",
  "Relative Importance",
  "Ranking (grouped)",
  "Year to Date",
  "Process Control (rolling mean)",
  "Process Control (mean)",
  "Correlation",
  "Mutual Information",
  "Clustering (k-means)",
  "Anomaly (spike)",
  "Anomaly (trend)",
  "Period over Period",
  "Period Changes",
  "Period Changes (detailed)",
  "Period over Period (selected)",
  "Trend with Forecast",
  "Time Series Decomposition",
];

export function Analysis() {
  const searchParams = useSearchParams();
  const surveyId = searchParams.get("surveyId");

  const [surveyData, setSurveyData] = useState<SurveyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnalysisType, setSelectedAnalysisType] = useState<AnalysisType | "">("");
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisConfig[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    if (!surveyId) {
      setError("No survey ID provided");
      setIsLoading(false);
      return;
    }

    const fetchSurveyData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/survey/${surveyId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch survey data");
        }
        const data = await response.json();
        setSurveyData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load survey data");
        console.error("Error fetching survey:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSurveyData();
  }, [surveyId]);

  const handleFieldToggle = (field: string) => {
    if (!selectedAnalysisType) return;

    const requirements = ANALYSIS_REQUIREMENTS[selectedAnalysisType];
    if (selectedFields.includes(field)) {
      setSelectedFields(selectedFields.filter((f) => f !== field));
    } else {
      if (selectedFields.length < requirements.max) {
        setSelectedFields([...selectedFields, field]);
      }
    }
  };

  const canExecuteAnalysis = () => {
    if (!selectedAnalysisType) return false;
    const requirements = ANALYSIS_REQUIREMENTS[selectedAnalysisType];
    return (
      selectedFields.length >= requirements.min &&
      selectedFields.length <= requirements.max
    );
  };

  const executeAnalysis = async () => {
    if (!selectedAnalysisType || !canExecuteAnalysis() || !surveyData) return;

    setIsExecuting(true);
    try {
      // Simulate analysis execution
      // In a real implementation, this would call an API endpoint
      const result = performAnalysis(
        selectedAnalysisType,
        selectedFields,
        surveyData.data
      );

      const newAnalysis: AnalysisConfig = {
        id: Date.now().toString(),
        type: selectedAnalysisType,
        fields: [...selectedFields],
        result,
      };

      setAnalyses([...analyses, newAnalysis]);
      setSelectedAnalysisType("");
      setSelectedFields([]);
    } catch (err) {
      console.error("Analysis error:", err);
      alert("Failed to execute analysis");
    } finally {
      setIsExecuting(false);
    }
  };

  const removeAnalysis = (id: string) => {
    setAnalyses(analyses.filter((a) => a.id !== id));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading survey data...</p>
      </div>
    );
  }

  if (error || !surveyData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error || "Survey not found"}</p>
        </div>
      </div>
    );
  }

  const requirements = selectedAnalysisType
    ? ANALYSIS_REQUIREMENTS[selectedAnalysisType]
    : null;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Sidebar - Fields */}
      <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Fields</h2>
          <p className="text-xs text-gray-500 mt-1">
            {surveyData.variablesList.length} fields available
          </p>
        </div>
        <div className="p-2">
          {surveyData.variablesList.map((field) => (
            <button
              key={field}
              onClick={() => handleFieldToggle(field)}
              disabled={!selectedAnalysisType}
              className={`w-full text-left px-3 py-2 mb-1 rounded-md text-sm transition-colors ${
                selectedFields.includes(field)
                  ? "bg-blue-100 text-blue-800 font-medium"
                  : selectedAnalysisType
                  ? "hover:bg-gray-100 text-gray-700"
                  : "text-gray-400 cursor-not-allowed"
              }`}
            >
              {field}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <h1 className="text-2xl font-bold text-gray-800">{surveyData.title}</h1>
          <p className="text-sm text-gray-600 mt-1">
            {surveyData.numInstances} instances, {surveyData.numVariables} variables
          </p>
        </div>

        {/* Right Panel - Analysis Configuration */}
        <div className="flex-1 flex overflow-hidden">
          <div className="w-80 bg-white border-r border-gray-200 p-4 overflow-y-auto">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Analysis Configuration
            </h2>

            {/* Analysis Type Dropdown */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Analysis Type
              </label>
              <select
                value={selectedAnalysisType}
                onChange={(e) => {
                  setSelectedAnalysisType(e.target.value as AnalysisType | "");
                  setSelectedFields([]);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select analysis type...</option>
                {ANALYSIS_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {requirements && (
                <p className="text-xs text-gray-500 mt-1">{requirements.description}</p>
              )}
            </div>

            {/* Selected Fields Display */}
            {selectedAnalysisType && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selected Fields ({selectedFields.length}
                  {requirements
                    ? `/${requirements.min}-${requirements.max}`
                    : ""})
                </label>
                <div className="min-h-[100px] border border-gray-200 rounded-md p-2 bg-gray-50">
                  {selectedFields.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">
                      Select fields from the left panel
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {selectedFields.map((field) => (
                        <div
                          key={field}
                          className="flex items-center justify-between px-2 py-1 bg-white rounded border border-gray-200"
                        >
                          <span className="text-xs text-gray-700">{field}</span>
                          <button
                            onClick={() =>
                              setSelectedFields(
                                selectedFields.filter((f) => f !== field)
                              )
                            }
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Execute Button */}
            {selectedAnalysisType && (
              <button
                onClick={executeAnalysis}
                disabled={!canExecuteAnalysis() || isExecuting}
                className={`w-full px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
                  canExecuteAnalysis() && !isExecuting
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                {isExecuting ? "Executing..." : "Execute Analysis"}
              </button>
            )}
          </div>

          {/* Analysis Results Area */}
          <div className="flex-1 overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Analysis Results
            </h2>
            {analyses.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>No analyses yet. Configure and execute an analysis to see results.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {analyses.map((analysis) => (
                  <AnalysisResultCard
                    key={analysis.id}
                    analysis={analysis}
                    onRemove={() => removeAnalysis(analysis.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Analysis Result Card Component
function AnalysisResultCard({
  analysis,
  onRemove,
}: {
  analysis: AnalysisConfig;
  onRemove: () => void;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800">{analysis.type}</h3>
          <p className="text-xs text-gray-500 mt-1">
            Fields: {analysis.fields.join(", ")}
          </p>
        </div>
        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 transition-colors"
        >
          ×
        </button>
      </div>
      <div className="mt-4">
        <AnalysisVisualization result={analysis.result} type={analysis.type} />
      </div>
    </div>
  );
}

// Analysis Visualization Component
function AnalysisVisualization({
  result,
  type,
}: {
  result: any;
  type: AnalysisType;
}) {
  if (!result) {
    return <p className="text-gray-400">No result available</p>;
  }

  if (result.type === "plotly") {
    const plotData = (result.data ?? []) as PlotlyData[];
    const layout = (result.layout ?? {}) as PlotlyLayout;
    const config = (result.config ?? {}) as Record<string, unknown>;

    return (
      <div className="border border-gray-200 rounded p-3 bg-white">
        <Plot
          data={plotData}
          layout={{
            title: layout.title ?? type,
            autosize: true,
            margin: { l: 48, r: 16, t: 48, b: 48, ...(layout.margin ?? {}) },
            ...layout,
          }}
          config={{
            responsive: true,
            displaylogo: false,
            ...config,
          }}
          style={{ width: "100%", height: 340 }}
          useResizeHandler
        />
      </div>
    );
  }

  if (result.type === "calculation") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Object.entries(result.data).map(([key, value]) => (
          <div
            key={key}
            className="bg-blue-50 border border-blue-200 rounded p-3"
          >
            <p className="text-xs text-blue-600 font-medium">{key}</p>
            <p className="text-lg font-bold text-blue-800 mt-1">
              {typeof value === "number" ? value.toFixed(2) : String(value)}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="text-sm text-gray-600">
      <pre className="bg-gray-50 p-3 rounded overflow-auto">
        {JSON.stringify(result, null, 2)}
      </pre>
    </div>
  );
}

// Analysis execution logic
function performAnalysis(
  type: AnalysisType,
  fields: string[],
  data: Record<string, any>[]
): any {
  // Basic analysis implementations
  // In production, these would be more sophisticated

  const allFields = data.length > 0 ? Object.keys(data[0] ?? {}) : [];
  const numericFieldsAll = allFields.filter((f) => isMostlyNumeric(f, data));
  const dateFieldsAll = allFields.filter((f) => isMostlyDateLike(f, data));

  switch (type) {
    case "Calculated Measure (KPI)": {
      const numericFields = fields.filter((f) => {
        const sample = data[0]?.[f];
        return typeof sample === "number";
      });

      const sums: Record<string, number> = {};
      const counts: Record<string, number> = {};

      data.forEach((row) => {
        numericFields.forEach((field) => {
          const value = row[field];
          if (typeof value === "number") {
            sums[field] = (sums[field] || 0) + value;
            counts[field] = (counts[field] || 0) + 1;
          }
        });
      });

      const averages: Record<string, number> = {};
      numericFields.forEach((field) => {
        averages[`${field}_avg`] = counts[field] > 0 ? sums[field] / counts[field] : 0;
        averages[`${field}_sum`] = sums[field] || 0;
        averages[`${field}_count`] = counts[field] || 0;
      });

      return {
        type: "calculation",
        data: averages,
      };
    }

    case "Ranking": {
      const field = fields[0];
      const values: Record<string, number> = {};

      data.forEach((row) => {
        const key = String(row[field] || "Unknown");
        const value = row[field];
        if (typeof value === "number") {
          values[key] = (values[key] || 0) + value;
        } else {
          values[key] = (values[key] || 0) + 1;
        }
      });

      const sorted = Object.entries(values)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      return {
        type: "plotly",
        data: [
          {
            type: "bar",
            x: sorted.map(([, value]) => value),
            y: sorted.map(([key]) => key),
            orientation: "h",
            marker: { color: "#2563eb" },
          },
        ],
        layout: {
          title: `Ranking: ${field}`,
          xaxis: { title: "Value" },
          yaxis: { automargin: true },
        },
      };
    }

    case "Ranking (grouped)": {
      // fields: [groupField, valueField?]
      const groupField = fields[0];
      const valueField = fields[1];

      const grouped: Record<string, Record<string, number>> = {};
      for (const row of data) {
        const group = String(row[groupField] ?? "Unknown");
        const item = valueField ? String(row[valueField] ?? "Unknown") : "Count";
        grouped[group] ||= {};
        grouped[group][item] = (grouped[group][item] || 0) + (valueField ? 1 : 1);
      }

      const groups = Object.keys(grouped).slice(0, 15);
      const items = Array.from(
        new Set(groups.flatMap((g) => Object.keys(grouped[g] ?? {})))
      ).slice(0, 10);

      const traces = items.map((item) => ({
        type: "bar",
        name: item,
        x: groups,
        y: groups.map((g) => grouped[g]?.[item] ?? 0),
      }));

      return {
        type: "plotly",
        data: traces,
        layout: {
          title: `Ranking (grouped): ${groupField}${valueField ? ` × ${valueField}` : ""}`,
          barmode: "group",
          xaxis: { automargin: true },
          yaxis: { title: "Count" },
        },
      };
    }

    case "Breakdown": {
      const field = fields[0];
      const breakdown: Record<string, number> = {};

      data.forEach((row) => {
        const key = String(row[field] || "Unknown");
        breakdown[key] = (breakdown[key] || 0) + 1;
      });

      const entries = Object.entries(breakdown).sort(([, a], [, b]) => b - a);
      const top = entries.slice(0, 25);
      const other = entries.slice(25).reduce((acc, [, v]) => acc + v, 0);
      const labels = [...top.map(([k]) => k), ...(other > 0 ? ["Other"] : [])];
      const counts = [...top.map(([, v]) => v), ...(other > 0 ? [other] : [])];

      return {
        type: "plotly",
        data: [
          {
            type: "bar",
            x: labels,
            y: counts,
            marker: { color: "#10b981" },
          },
        ],
        layout: {
          title: `Breakdown: ${field}`,
          xaxis: { automargin: true, tickangle: -30 },
          yaxis: { title: "Count" },
        },
      };
    }

    case "Breakdown (geo spatial)": {
      const geoField = fields[0];
      const valueField = fields[1];

      const counts: Record<string, number> = {};
      for (const row of data) {
        const key = String(row[geoField] ?? "Unknown");
        const v =
          valueField && typeof row[valueField] === "number" ? row[valueField] : 1;
        counts[key] = (counts[key] || 0) + v;
      }

      const entries = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 30);
      return {
        type: "plotly",
        data: [
          {
            type: "bar",
            x: entries.map(([k]) => k),
            y: entries.map(([, v]) => v),
            marker: { color: "#0ea5e9" },
          },
        ],
        layout: {
          title: `Geo Breakdown: ${geoField}${valueField ? ` (sum ${valueField})` : ""}`,
          xaxis: { automargin: true, tickangle: -30 },
          yaxis: { title: valueField ? "Sum" : "Count" },
        },
      };
    }

    case "Overview": {
      const totalRecords = data.length;
      const fieldCounts: Record<string, number> = {};

      if (data.length > 0) {
        Object.keys(data[0]).forEach((field) => {
          const uniqueValues = new Set(
            data.map((row) => String(row[field] || "null"))
          );
          fieldCounts[field] = uniqueValues.size;
        });
      }

      return {
        type: "calculation",
        data: {
          "Total Records": totalRecords,
          "Unique Fields": Object.keys(fieldCounts).length,
          ...Object.fromEntries(
            Object.entries(fieldCounts).slice(0, 5).map(([k, v]) => [
              `${k} (unique)`,
              v,
            ])
          ),
        },
      };
    }

    case "Trend Over Time": {
      // Expect [timeField, valueField?]
      const timeField = fields[0] ?? dateFieldsAll[0];
      const valueField = fields[1] ?? numericFieldsAll[0];
      if (!timeField) {
        return { type: "calculation", data: { Error: "No time field detected" } };
      }

      const points: Array<{ t: number; y: number }> = [];
      for (const row of data) {
        const t = toEpochMs(row[timeField]);
        if (t == null) continue;
        const y =
          valueField && typeof row[valueField] === "number" ? row[valueField] : 1;
        points.push({ t, y });
      }
      points.sort((a, b) => a.t - b.t);
      const buckets = bucketByDay(points);

      return {
        type: "plotly",
        data: [
          {
            type: "scatter",
            mode: "lines+markers",
            x: buckets.map((b) => new Date(b.t)),
            y: buckets.map((b) => b.y),
            line: { color: "#2563eb" },
          },
        ],
        layout: {
          title: `Trend Over Time: ${valueField ? valueField : "Count"} by ${timeField}`,
          xaxis: { title: timeField },
          yaxis: { title: valueField ? "Value" : "Count" },
        },
      };
    }

    case "Comparison": {
      // Expect [categoryField, valueField] else fallback to top 2 numeric means
      const categoryField = fields[0];
      const valueField = fields[1];

      if (categoryField && valueField && typeof data[0]?.[valueField] === "number") {
        const agg: Record<string, { sum: number; n: number }> = {};
        for (const row of data) {
          const cat = String(row[categoryField] ?? "Unknown");
          const v = row[valueField];
          if (typeof v !== "number") continue;
          agg[cat] ||= { sum: 0, n: 0 };
          agg[cat].sum += v;
          agg[cat].n += 1;
        }
        const entries = Object.entries(agg)
          .map(([k, a]) => [k, a.n ? a.sum / a.n : 0] as const)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 25);
        return {
          type: "plotly",
          data: [
            {
              type: "bar",
              x: entries.map(([k]) => k),
              y: entries.map(([, v]) => v),
              marker: { color: "#7c3aed" },
            },
          ],
          layout: {
            title: `Comparison: avg(${valueField}) by ${categoryField}`,
            xaxis: { automargin: true, tickangle: -30 },
            yaxis: { title: `avg(${valueField})` },
          },
        };
      }

      // fallback: compare means of selected numeric fields
      const nums = fields.filter((f) => isMostlyNumeric(f, data)).slice(0, 8);
      const candidates = nums.length ? nums : numericFieldsAll.slice(0, 8);
      const means = candidates.map((f) => [f, meanOfField(f, data)] as const);
      return {
        type: "plotly",
        data: [
          { type: "bar", x: means.map(([f]) => f), y: means.map(([, m]) => m) },
        ],
        layout: {
          title: "Comparison (means)",
          xaxis: { automargin: true, tickangle: -30 },
          yaxis: { title: "Mean" },
        },
      };
    }

    case "Relative Importance": {
      // Heuristic: importance = |corr(feature, target)|; target is last selected field
      const nums = fields.filter((f) => isMostlyNumeric(f, data));
      if (nums.length < 2) {
        return {
          type: "calculation",
          data: { Error: "Select at least 2 numeric fields (features + target)" },
        };
      }
      const target = nums[nums.length - 1];
      const features = nums.slice(0, -1);
      const scores = features
        .map((f) => [f, Math.abs(pearson(f, target, data))] as const)
        .sort(([, a], [, b]) => b - a);
      return {
        type: "plotly",
        data: [
          {
            type: "bar",
            x: scores.map(([f]) => f),
            y: scores.map(([, s]) => s),
            marker: { color: "#f59e0b" },
          },
        ],
        layout: {
          title: `Relative Importance vs ${target} (|corr|)`,
          xaxis: { automargin: true, tickangle: -30 },
          yaxis: { title: "|corr|" , range: [0, 1] },
        },
      };
    }

    case "Year to Date": {
      const timeField = fields.find((f) => isMostlyDateLike(f, data)) ?? dateFieldsAll[0];
      const valueField = fields.find((f) => isMostlyNumeric(f, data)) ?? numericFieldsAll[0];
      if (!timeField) {
        return { type: "calculation", data: { Error: "No date field detected" } };
      }
      const pts: Array<{ t: number; y: number }> = [];
      for (const row of data) {
        const t = toEpochMs(row[timeField]);
        if (t == null) continue;
        const y = valueField && typeof row[valueField] === "number" ? row[valueField] : 1;
        pts.push({ t, y });
      }
      pts.sort((a, b) => a.t - b.t);
      const yearStart = new Date(new Date(pts[0]?.t ?? Date.now()).getFullYear(), 0, 1).getTime();
      let cum = 0;
      const x: Date[] = [];
      const y: number[] = [];
      for (const p of pts) {
        if (p.t < yearStart) continue;
        cum += p.y;
        x.push(new Date(p.t));
        y.push(cum);
      }
      return {
        type: "plotly",
        data: [{ type: "scatter", mode: "lines", x, y, line: { color: "#16a34a" } }],
        layout: {
          title: `Year to Date: cumulative ${valueField ?? "Count"}`,
          xaxis: { title: timeField },
          yaxis: { title: "Cumulative" },
        },
      };
    }

    case "Process Control (mean)":
    case "Process Control (rolling mean)": {
      const timeField = fields.find((f) => isMostlyDateLike(f, data)) ?? dateFieldsAll[0];
      const valueField = fields.find((f) => isMostlyNumeric(f, data)) ?? numericFieldsAll[0];
      if (!timeField || !valueField) {
        return {
          type: "calculation",
          data: { Error: "Need a date-like field and a numeric field" },
        };
      }
      const pts = extractTimeSeries(timeField, valueField, data);
      if (pts.length < 2) {
        return { type: "calculation", data: { Error: "Not enough time series points" } };
      }
      const xs = pts.map((p) => new Date(p.t));
      const ys = pts.map((p) => p.y);
      const mean = ys.reduce((a, b) => a + b, 0) / ys.length;
      const std = stddev(ys);
      const ucl = mean + 3 * std;
      const lcl = mean - 3 * std;
      const roll = movingAverage(ys, Math.min(20, Math.max(5, Math.floor(ys.length / 10))));

      return {
        type: "plotly",
        data: [
          { type: "scatter", mode: "lines", x: xs, y: ys, name: valueField, line: { color: "#2563eb" } },
          { type: "scatter", mode: "lines", x: xs, y: xs.map(() => mean), name: "Mean", line: { dash: "dash", color: "#111827" } },
          { type: "scatter", mode: "lines", x: xs, y: xs.map(() => ucl), name: "UCL (3σ)", line: { dash: "dot", color: "#dc2626" } },
          { type: "scatter", mode: "lines", x: xs, y: xs.map(() => lcl), name: "LCL (3σ)", line: { dash: "dot", color: "#dc2626" } },
          ...(type === "Process Control (rolling mean)"
            ? [{ type: "scatter", mode: "lines", x: xs, y: roll, name: "Rolling mean", line: { color: "#f59e0b" } }]
            : []),
        ],
        layout: {
          title: `${type}: ${valueField}`,
          xaxis: { title: timeField },
          yaxis: { title: valueField },
        },
      };
    }

    case "Correlation": {
      const numericFields = fields.filter((f) => {
        const sample = data[0]?.[f];
        return typeof sample === "number";
      });

      if (numericFields.length < 2) {
        return {
          type: "calculation",
          data: { Error: "Need at least 2 numeric fields" },
        };
      }

      return {
        type: "plotly",
        data: [
          {
            type: "heatmap",
            x: numericFields,
            y: numericFields,
            z: buildCorrelationMatrix(numericFields, data),
            zmin: -1,
            zmax: 1,
            colorscale: "RdBu",
            reversescale: true,
          },
        ],
        layout: {
          title: "Correlation (Pearson)",
          xaxis: { automargin: true },
          yaxis: { automargin: true },
        },
      };
    }

    case "Mutual Information": {
      // Simple discrete MI via binning numeric fields and using categorical counts
      const chosen = fields.slice(0, 6);
      const usable = chosen.length ? chosen : allFields.slice(0, 6);
      if (usable.length < 2) {
        return { type: "calculation", data: { Error: "Need at least 2 fields" } };
      }
      const z = buildMutualInformationMatrix(usable, data);
      return {
        type: "plotly",
        data: [
          {
            type: "heatmap",
            x: usable,
            y: usable,
            z,
            colorscale: "Viridis",
          },
        ],
        layout: { title: "Mutual Information (approx.)", xaxis: { automargin: true }, yaxis: { automargin: true } },
      };
    }

    case "Clustering (k-means)": {
      const nums = fields.filter((f) => isMostlyNumeric(f, data));
      const candidates = (nums.length ? nums : numericFieldsAll).slice(0, 3);
      if (candidates.length < 2) {
        return { type: "calculation", data: { Error: "Need at least 2 numeric fields" } };
      }
      const xField = candidates[0];
      const yField = candidates[1];
      const pts: Array<{ x: number; y: number }> = [];
      for (const r of data) {
        const x = r[xField];
        const y = r[yField];
        if (typeof x === "number" && typeof y === "number") pts.push({ x, y });
        if (pts.length >= 1500) break;
      }
      const k = 3;
      const { labels } = kmeans2D(pts, k, 20);
      const traces = Array.from({ length: k }, (_, i) => ({
        type: "scatter",
        mode: "markers",
        name: `Cluster ${i + 1}`,
        x: pts.filter((_, idx) => labels[idx] === i).map((p) => p.x),
        y: pts.filter((_, idx) => labels[idx] === i).map((p) => p.y),
        marker: { size: 6 },
      }));
      return {
        type: "plotly",
        data: traces,
        layout: {
          title: `k-means (k=${k}): ${xField} vs ${yField}`,
          xaxis: { title: xField },
          yaxis: { title: yField },
        },
      };
    }

    case "Anomaly (spike)":
    case "Anomaly (trend)": {
      const timeField = fields.find((f) => isMostlyDateLike(f, data)) ?? dateFieldsAll[0];
      const valueField = fields.find((f) => isMostlyNumeric(f, data)) ?? numericFieldsAll[0];
      if (!timeField || !valueField) {
        return { type: "calculation", data: { Error: "Need a date-like field and a numeric field" } };
      }
      const pts = extractTimeSeries(timeField, valueField, data);
      if (pts.length < 5) return { type: "calculation", data: { Error: "Not enough points" } };
      const xs = pts.map((p) => new Date(p.t));
      const ys = pts.map((p) => p.y);
      const mu = ys.reduce((a, b) => a + b, 0) / ys.length;
      const sd = stddev(ys);
      const thresh = mu + 3 * sd;
      const anomalies = pts
        .map((p, idx) => ({ ...p, idx }))
        .filter((p) => (type === "Anomaly (spike)" ? p.y > thresh : Math.abs(p.y - mu) > 2 * sd));
      return {
        type: "plotly",
        data: [
          { type: "scatter", mode: "lines", x: xs, y: ys, name: valueField, line: { color: "#2563eb" } },
          { type: "scatter", mode: "markers", x: anomalies.map((a) => new Date(a.t)), y: anomalies.map((a) => a.y), name: "Anomaly", marker: { color: "#dc2626", size: 10 } },
          { type: "scatter", mode: "lines", x: xs, y: xs.map(() => thresh), name: "Threshold", line: { dash: "dot", color: "#dc2626" } },
        ],
        layout: { title: `${type}: ${valueField}`, xaxis: { title: timeField }, yaxis: { title: valueField } },
      };
    }

    case "Period over Period":
    case "Period over Period (selected)":
    case "Period Changes":
    case "Period Changes (detailed)": {
      const timeField = fields.find((f) => isMostlyDateLike(f, data)) ?? dateFieldsAll[0];
      const valueField = fields.find((f) => isMostlyNumeric(f, data)) ?? numericFieldsAll[0];
      if (!timeField || !valueField) {
        return { type: "calculation", data: { Error: "Need a date-like field and a numeric field" } };
      }
      const pts = extractTimeSeries(timeField, valueField, data);
      if (pts.length < 2) return { type: "calculation", data: { Error: "Not enough points" } };
      const { current, previous } = splitLastPeriod(pts);
      const sumCur = current.reduce((a, b) => a + b.y, 0);
      const sumPrev = previous.reduce((a, b) => a + b.y, 0);
      const delta = sumCur - sumPrev;
      const pct = sumPrev !== 0 ? delta / sumPrev : null;
      return {
        type: "plotly",
        data: [
          { type: "bar", x: ["Previous", "Current"], y: [sumPrev, sumCur], marker: { color: ["#94a3b8", "#2563eb"] } },
        ],
        layout: {
          title: `${type}: ${valueField}`,
          yaxis: { title: `Sum(${valueField})` },
          annotations: [
            {
              x: 1,
              y: sumCur,
              text: `Δ ${delta.toFixed(2)}${pct == null ? "" : ` (${(pct * 100).toFixed(1)}%)`}`,
              showarrow: false,
              yshift: 18,
            },
          ],
        },
      };
    }

    case "Trend with Forecast": {
      const timeField = fields.find((f) => isMostlyDateLike(f, data)) ?? dateFieldsAll[0];
      const valueField = fields.find((f) => isMostlyNumeric(f, data)) ?? numericFieldsAll[0];
      if (!timeField || !valueField) {
        return { type: "calculation", data: { Error: "Need a date-like field and a numeric field" } };
      }
      const pts = extractTimeSeries(timeField, valueField, data);
      if (pts.length < 5) return { type: "calculation", data: { Error: "Not enough points" } };
      const xs = pts.map((p) => p.t);
      const ys = pts.map((p) => p.y);
      const { a, b } = linearRegression(xs, ys); // y = a + b*x
      const lastT = xs[xs.length - 1];
      const step = xs.length >= 2 ? xs[xs.length - 1] - xs[xs.length - 2] : 24 * 3600 * 1000;
      const forecastN = 10;
      const fx: number[] = [];
      const fy: number[] = [];
      for (let i = 1; i <= forecastN; i++) {
        const t = lastT + step * i;
        fx.push(t);
        fy.push(a + b * t);
      }
      return {
        type: "plotly",
        data: [
          { type: "scatter", mode: "lines", x: xs.map((t) => new Date(t)), y: ys, name: "Actual", line: { color: "#2563eb" } },
          { type: "scatter", mode: "lines", x: fx.map((t) => new Date(t)), y: fy, name: "Forecast", line: { color: "#f59e0b", dash: "dash" } },
        ],
        layout: { title: `Trend with Forecast: ${valueField}`, xaxis: { title: timeField }, yaxis: { title: valueField } },
      };
    }

    case "Time Series Decomposition": {
      const timeField = fields.find((f) => isMostlyDateLike(f, data)) ?? dateFieldsAll[0];
      const valueField = fields.find((f) => isMostlyNumeric(f, data)) ?? numericFieldsAll[0];
      if (!timeField || !valueField) {
        return { type: "calculation", data: { Error: "Need a date-like field and a numeric field" } };
      }
      const pts = extractTimeSeries(timeField, valueField, data);
      const xs = pts.map((p) => new Date(p.t));
      const ys = pts.map((p) => p.y);
      const trend = movingAverage(ys, Math.min(30, Math.max(7, Math.floor(ys.length / 8))));
      const resid = ys.map((v, i) => v - trend[i]);
      return {
        type: "plotly",
        data: [
          { type: "scatter", mode: "lines", x: xs, y: ys, name: "Observed", line: { color: "#2563eb" } },
          { type: "scatter", mode: "lines", x: xs, y: trend, name: "Trend (MA)", line: { color: "#16a34a" } },
          { type: "scatter", mode: "lines", x: xs, y: resid, name: "Residual", line: { color: "#dc2626" } },
        ],
        layout: { title: `Time Series Decomposition: ${valueField}`, xaxis: { title: timeField } },
      };
    }

    default:
      return {
        // fall back to a generic distribution chart
        type: "plotly",
        data: [
          {
            type: "histogram",
            x: isMostlyNumeric(fields[0], data)
              ? data.map((r) => r[fields[0]]).filter((v) => typeof v === "number")
              : data.map((r) => String(r[fields[0]] ?? "Unknown")),
            marker: { color: "#64748b" },
          },
        ],
        layout: {
          title: `${type}: ${fields[0] ?? "field"}`,
          xaxis: { automargin: true },
          yaxis: { title: "Count" },
        },
      };
  }
}

function buildCorrelationMatrix(
  fields: string[],
  rows: Record<string, any>[]
): number[][] {
  const z: number[][] = [];
  for (let i = 0; i < fields.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < fields.length; j++) {
      if (i === j) {
        row.push(1);
        continue;
      }
      row.push(pearson(fields[i], fields[j], rows));
    }
    z.push(row);
  }
  return z;
}

function pearson(
  fieldA: string,
  fieldB: string,
  rows: Record<string, any>[]
): number {
  const pairs: Array<[number, number]> = [];
  for (const r of rows) {
    const a = r[fieldA];
    const b = r[fieldB];
    if (typeof a === "number" && typeof b === "number") pairs.push([a, b]);
  }
  if (pairs.length < 2) return 0;

  const meanA = pairs.reduce((acc, [a]) => acc + a, 0) / pairs.length;
  const meanB = pairs.reduce((acc, [, b]) => acc + b, 0) / pairs.length;

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (const [a, b] of pairs) {
    const da = a - meanA;
    const db = b - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }
  if (denA === 0 || denB === 0) return 0;
  return num / Math.sqrt(denA * denB);
}

function isMostlyNumeric(field: string | undefined, rows: Record<string, any>[]): boolean {
  if (!field) return false;
  let seen = 0;
  let numeric = 0;
  for (const r of rows) {
    const v = r[field];
    if (v == null) continue;
    seen++;
    if (typeof v === "number" && Number.isFinite(v)) numeric++;
    if (seen >= 50) break;
  }
  return seen > 0 && numeric / seen >= 0.7;
}

function isMostlyDateLike(field: string | undefined, rows: Record<string, any>[]): boolean {
  if (!field) return false;
  let seen = 0;
  let ok = 0;
  for (const r of rows) {
    const v = r[field];
    if (v == null) continue;
    seen++;
    if (toEpochMs(v) != null) ok++;
    if (seen >= 50) break;
  }
  return seen > 0 && ok / seen >= 0.7;
}

function toEpochMs(value: any): number | null {
  if (value == null) return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : null;
  if (typeof value === "number" && Number.isFinite(value)) {
    // Excel serial date (common in uploaded datasets). Excel epoch: 1899-12-30
    const excelEpoch = Date.UTC(1899, 11, 30);
    return excelEpoch + Math.round(value) * 24 * 3600 * 1000;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isFinite(d.getTime()) ? d.getTime() : null;
  }
  return null;
}

function bucketByDay(points: Array<{ t: number; y: number }>): Array<{ t: number; y: number }> {
  const map = new Map<number, number>();
  for (const p of points) {
    const d = new Date(p.t);
    const key = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    map.set(key, (map.get(key) ?? 0) + p.y);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([t, y]) => ({ t, y }));
}

function meanOfField(field: string, rows: Record<string, any>[]): number {
  let sum = 0;
  let n = 0;
  for (const r of rows) {
    const v = r[field];
    if (typeof v === "number" && Number.isFinite(v)) {
      sum += v;
      n++;
    }
  }
  return n ? sum / n : 0;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const v = values.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / (values.length - 1);
  return Math.sqrt(v);
}

function movingAverage(values: number[], window: number): number[] {
  const w = Math.max(1, window);
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= w) sum -= values[i - w];
    const denom = Math.min(i + 1, w);
    out.push(sum / denom);
  }
  return out;
}

function extractTimeSeries(
  timeField: string,
  valueField: string,
  rows: Record<string, any>[]
): Array<{ t: number; y: number }> {
  const pts: Array<{ t: number; y: number }> = [];
  for (const r of rows) {
    const t = toEpochMs(r[timeField]);
    const y = r[valueField];
    if (t == null) continue;
    if (typeof y !== "number" || !Number.isFinite(y)) continue;
    pts.push({ t, y });
  }
  pts.sort((a, b) => a.t - b.t);
  return pts;
}

function splitLastPeriod(pts: Array<{ t: number; y: number }>): {
  current: Array<{ t: number; y: number }>;
  previous: Array<{ t: number; y: number }>;
} {
  // Define “period” as last 25% of points (or minimum 10 points)
  const n = pts.length;
  const period = Math.max(10, Math.floor(n * 0.25));
  const current = pts.slice(n - period);
  const previous = pts.slice(Math.max(0, n - 2 * period), n - period);
  return { current, previous };
}

function linearRegression(xs: number[], ys: number[]): { a: number; b: number } {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return { a: 0, b: 0 };
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    num += dx * (ys[i] - meanY);
    den += dx * dx;
  }
  const b = den === 0 ? 0 : num / den;
  const a = meanY - b * meanX;
  return { a, b };
}

function kmeans2D(
  pts: Array<{ x: number; y: number }>,
  k: number,
  iters: number
): { labels: number[]; centers: Array<{ x: number; y: number }> } {
  if (pts.length === 0) return { labels: [], centers: [] };
  const centers: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < k; i++) centers.push({ ...pts[Math.floor((i * pts.length) / k)] });
  const labels = new Array(pts.length).fill(0);
  for (let iter = 0; iter < iters; iter++) {
    // assign
    for (let i = 0; i < pts.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const dx = pts[i].x - centers[c].x;
        const dy = pts[i].y - centers[c].y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      labels[i] = best;
    }
    // update
    const sum = Array.from({ length: k }, () => ({ x: 0, y: 0, n: 0 }));
    for (let i = 0; i < pts.length; i++) {
      const c = labels[i];
      sum[c].x += pts[i].x;
      sum[c].y += pts[i].y;
      sum[c].n += 1;
    }
    for (let c = 0; c < k; c++) {
      if (sum[c].n === 0) continue;
      centers[c] = { x: sum[c].x / sum[c].n, y: sum[c].y / sum[c].n };
    }
  }
  return { labels, centers };
}

function buildMutualInformationMatrix(
  fields: string[],
  rows: Record<string, any>[]
): number[][] {
  const z: number[][] = [];
  for (let i = 0; i < fields.length; i++) {
    const row: number[] = [];
    for (let j = 0; j < fields.length; j++) {
      if (i === j) {
        row.push(0);
        continue;
      }
      row.push(mutualInformation(fields[i], fields[j], rows));
    }
    z.push(row);
  }
  return z;
}

function mutualInformation(
  aField: string,
  bField: string,
  rows: Record<string, any>[]
): number {
  const pairs: Array<[string, string]> = [];
  for (const r of rows) {
    const a = r[aField];
    const b = r[bField];
    if (a == null || b == null) continue;
    pairs.push([discretize(a), discretize(b)]);
    if (pairs.length >= 5000) break;
  }
  if (pairs.length < 2) return 0;

  const n = pairs.length;
  const pA = new Map<string, number>();
  const pB = new Map<string, number>();
  const pAB = new Map<string, number>();
  for (const [a, b] of pairs) {
    pA.set(a, (pA.get(a) ?? 0) + 1);
    pB.set(b, (pB.get(b) ?? 0) + 1);
    pAB.set(`${a}|||${b}`, (pAB.get(`${a}|||${b}`) ?? 0) + 1);
  }
  let mi = 0;
  for (const [key, cAB] of pAB.entries()) {
    const [a, b] = key.split("|||");
    const p = cAB / n;
    const pa = (pA.get(a) ?? 0) / n;
    const pb = (pB.get(b) ?? 0) / n;
    if (pa > 0 && pb > 0) mi += p * Math.log(p / (pa * pb));
  }
  return mi;
}

function discretize(v: any): string {
  if (typeof v === "number" && Number.isFinite(v)) {
    // 10-bin quantization based on magnitude
    const bin = Math.floor(v * 10) / 10;
    return `n:${bin}`;
  }
  return `c:${String(v).trim().slice(0, 40)}`;
}
