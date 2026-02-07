"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { VisualizationsTab } from "./VisualizationsTab";

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
}) as React.ComponentType<any>;

 type TabKey = "trends" | "visualizations" | "geo";

 type FilterState = {
   [field: string]: string[];
 };

function isNumeric(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

 function getNumericFields(rows: Record<string, unknown>[]) {
   const numericFields = new Set<string>();
   for (const row of rows) {
     for (const [key, value] of Object.entries(row)) {
       if (isNumeric(value)) {
         numericFields.add(key);
       }
     }
   }
   return Array.from(numericFields);
 }

 function getCategoricalFields(rows: Record<string, unknown>[]) {
   const categoricalFields = new Set<string>();
   for (const row of rows) {
     for (const [key, value] of Object.entries(row)) {
       if (
         typeof value === "string" &&
           value.trim() !== "" &&
           key.toLowerCase() !== "id"
       ) {
         categoricalFields.add(key);
       }
     }
   }
   return Array.from(categoricalFields);
 }

 function applyFilters(
   rows: Record<string, unknown>[],
   filters: FilterState
 ): Record<string, unknown>[] {
   const activeFields = Object.keys(filters).filter(
     (f) => filters[f] && filters[f].length > 0
   );
   if (activeFields.length === 0) return rows;

   return rows.filter((row) => {
     return activeFields.every((field) => {
       const selectedValues = filters[field];
       const value = row[field];
       if (selectedValues.length === 0) return true;
       return selectedValues.includes(String(value));
     });
   });
 }

 function computeAverages(
   rows: Record<string, unknown>[],
   fields: string[]
 ): { field: string; average: number | null }[] {
   return fields.map((field) => {
     let sum = 0;
     let count = 0;
     for (const row of rows) {
       const value = row[field];
       if (isNumeric(value)) {
         sum += value;
         count += 1;
       }
     }
     return {
       field,
       average: count > 0 ? sum / count : null,
     };
   });
 }

const DEFAULT_SERIES_PALETTE = [
  "#22d3ee",
  "#f472b6",
  "#a78bfa",
  "#34d399",
  "#fbbf24",
  "#f87171",
];

function buildTimeSeriesTraces(
  rows: Record<string, unknown>[],
  fields: string[],
  xField: string | null,
  fieldColors: Record<string, string> = {}
) {
  if (!xField || rows.length === 0 || fields.length === 0) {
    return [];
  }

  type Bucket = {
    x: string | number;
    rows: Record<string, unknown>[];
  };

  const bucketMap = new Map<string | number, Bucket>();

  for (const row of rows) {
    const raw = row[xField];
    let key: string | number;
    if (typeof raw === "string") {
      key = raw.trim();
    } else if (isNumeric(raw)) {
      key = raw;
    } else if (raw != null) {
      key = String(raw);
    } else {
      key = "";
    }

    if (!bucketMap.has(key)) {
      bucketMap.set(key, { x: key, rows: [] });
    }
    bucketMap.get(key)!.rows.push(row);
  }

  const buckets = Array.from(bucketMap.values());
  const xLabels = buckets.map((b) => b.x);

  return fields.map((field, idx) => {
    const yValues = buckets.map(({ rows: bucketRows }) => {
      let sum = 0;
      let count = 0;
      for (const row of bucketRows) {
        const value = row[field];
        if (isNumeric(value)) {
          sum += value;
          count += 1;
        }
      }
      if (count === 0) return null;
      return (sum / count) * 100; // percentage scale
    });

    const lineColor =
      fieldColors[field] ??
      DEFAULT_SERIES_PALETTE[idx % DEFAULT_SERIES_PALETTE.length];

    return {
      x: xLabels,
      y: yValues,
      mode: "lines+markers",
      name: field,
      line: { color: lineColor },
      marker: { color: lineColor },
      hovertemplate: "%{x}<br>" + field + ": %{y:.2f}%<extra></extra>",
    };
  });
}

 const ReportsPage: React.FC = () => {
   const [states, setStates] = useState<string[]>([]);
   const [selectedState, setSelectedState] = useState<string>("");
   const [stateRows, setStateRows] = useState<Record<string, unknown>[]>([]);
   const [statesLoading, setStatesLoading] = useState(true);
   const [rowsLoading, setRowsLoading] = useState(false);
   const [activeTab, setActiveTab] = useState<TabKey>("trends");
   const [selectedAvgFields, setSelectedAvgFields] = useState<string[]>([]);
   const [selectedSeriesFields, setSelectedSeriesFields] = useState<string[]>(
     []
   );
  const [filters, setFilters] = useState<FilterState>({});
  const [selectedFilterFields, setSelectedFilterFields] = useState<string[]>(
    []
  );
  const [selectedXAxisField, setSelectedXAxisField] = useState<string | null>(
    null
  );
  const [fieldColors, setFieldColors] = useState<Record<string, string>>({});
  const [vizShowCurve, setVizShowCurve] = useState<Record<string, boolean>>({});
  const skipNextSaveRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/reports/field-colors");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const colors = data?.fieldColors;
        if (
          colors &&
          typeof colors === "object" &&
          !Array.isArray(colors) &&
          Object.values(colors).every(
            (v) => typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v)
          )
        ) {
          if (!cancelled) setFieldColors(colors as Record<string, string>);
        }
        const showCurve = data?.vizShowCurve;
        if (
          showCurve &&
          typeof showCurve === "object" &&
          !Array.isArray(showCurve) &&
          Object.values(showCurve).every((v) => typeof v === "boolean")
        ) {
          if (!cancelled)
            setVizShowCurve(showCurve as Record<string, boolean>);
        }
      } catch {
        // ignore fetch errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/reports/field-colors", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fieldColors,
            vizShowCurve,
          }),
        });
        if (!res.ok && !cancelled) {
          console.warn("Failed to save preferences");
        }
      } catch {
        // ignore save errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fieldColors, vizShowCurve]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatesLoading(true);
      try {
        const res = await fetch("/api/reports/states");
        if (!res.ok) return;
        const data = await res.json();
        const list = data.states ?? [];
        if (!cancelled) {
          setStates(list);
          if (list.length > 0 && !selectedState) {
            setSelectedState(list[0]);
          }
        }
      } finally {
        if (!cancelled) setStatesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedState) {
      setStateRows([]);
      return;
    }
    let cancelled = false;
    setRowsLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/reports/by-state?state=${encodeURIComponent(selectedState)}`
        );
        if (!res.ok) {
          if (!cancelled) setStateRows([]);
          return;
        }
        const data = await res.json();
        if (!cancelled) setStateRows(data.rows ?? []);
      } finally {
        if (!cancelled) setRowsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedState]);

   const allRows = stateRows;

   const numericFields = useMemo(
     () => getNumericFields(allRows),
     [allRows]
   );

   const categoricalFields = useMemo(
     () => getCategoricalFields(allRows),
     [allRows]
   );

  const allFieldNames = useMemo(() => {
    const set = new Set<string>();
    for (const row of allRows) {
      Object.keys(row).forEach((key) => set.add(key));
    }
    return Array.from(set).sort();
  }, [allRows]);

   const filteredRows = useMemo(
     () => applyFilters(allRows, filters),
     [allRows, filters]
   );

   const averages = useMemo(
     () => computeAverages(filteredRows, selectedAvgFields),
     [filteredRows, selectedAvgFields]
   );

  const defaultXAxisField = useMemo(() => {
    if (allFieldNames.includes("Month")) return "Month";
    if (allFieldNames.includes("date")) return "date";
    return allFieldNames[0] ?? null;
  }, [allFieldNames]);

  const effectiveXAxisField = selectedXAxisField ?? defaultXAxisField;

   const timeSeriesTraces = useMemo(
    () =>
      buildTimeSeriesTraces(
        filteredRows,
        selectedSeriesFields,
        effectiveXAxisField,
        fieldColors
      ),
    [filteredRows, selectedSeriesFields, effectiveXAxisField, fieldColors]
   );

  const handleToggleFilterValue = (field: string, value: string) => {
    setFilters((prev) => {
      const current = prev[field] ?? [];
      const exists = current.includes(value);
      const nextValues = exists
        ? current.filter((v) => v !== value)
        : [...current, value];
      return {
        ...prev,
        [field]: nextValues,
      };
    });
  };

   const handleStateChange = (
     event: React.ChangeEvent<HTMLSelectElement>
   ) => {
     const nextState = event.target.value;
     setSelectedState(nextState);
     // Reset selections when state changes to avoid confusion.
    setSelectedAvgFields([]);
    setSelectedSeriesFields([]);
    setFilters({});
    setSelectedFilterFields([]);
    setSelectedXAxisField(null);
   };

  const toggleSelectedField = (
    field: string,
    setState: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setState((prev) =>
      prev.includes(field)
        ? prev.filter((f) => f !== field)
        : [...prev, field]
    );
  };

   return (
     <div className="flex min-h-screen flex-col gap-6 bg-slate-950 px-8 py-6 text-slate-50">
       {/* State Selector */}
       <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-lg shadow-slate-950/40 backdrop-blur">
         <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
           <div>
             <h2 className="text-lg font-semibold tracking-tight">
               Reports by State
             </h2>
             <p className="text-sm text-slate-400">
               Select a state to explore trends, visualisations, and geo
               samples.
             </p>
           </div>
           <div className="flex items-center gap-3">
             <label
               htmlFor="state-select"
               className="text-sm font-medium text-slate-300"
             >
               State
             </label>
             <select
               id="state-select"
               value={selectedState}
               onChange={handleStateChange}
               disabled={statesLoading}
               className="min-w-[220px] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm shadow-inner focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 disabled:opacity-50"
             >
               {states.length === 0 && !statesLoading ? (
                 <option value="">No states with data</option>
               ) : (
                 states.map((state) => (
                   <option key={state} value={state}>
                     {state}
                   </option>
                 ))
               )}
             </select>
           </div>
         </div>
       </section>

       {/* Tabs + Content & Filters */}
       <section className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(260px,1fr)]">
         {/* Left: Tabs + content */}
         <div className="flex flex-col gap-2">
           {/* Tabs */}
           <div className="flex gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-1 text-sm font-medium">
             <button
               type="button"
               onClick={() => setActiveTab("trends")}
               className={`flex-1 rounded-lg px-3 py-2 transition ${
                 activeTab === "trends"
                   ? "bg-fuchsia-400 text-slate-950 shadow-md shadow-cyan-500/40"
                   : "text-slate-300 hover:bg-slate-800"
               }`}
             >
               Trends
             </button>
             
             <button
               type="button"
               onClick={() => setActiveTab("visualizations")}
               className={`flex-1 rounded-lg px-3 py-2 transition ${
                 activeTab === "visualizations"
                   ? "bg-orange-400 text-slate-950 shadow-md shadow-cyan-500/40"
                   : "text-slate-300 hover:bg-slate-800"
               }`}
             >
               Visualizations
             </button>
             <button
               type="button"
               onClick={() => setActiveTab("geo")}
               className={`flex-1 rounded-lg px-3 py-2 transition ${
                 activeTab === "geo"
                   ? "bg-yellow-300 text-slate-950 shadow-md shadow-cyan-500/40"
                   : "text-slate-300 hover:bg-slate-800"
               }`}
             >
               Geo Sample
             </button>
           </div>

           {/* Tab Content */}
           {activeTab === "trends" && (
             <div className="flex flex-col gap-4">
               {/* 1st part: Averages */}
               <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 pt-2 pb-4 shadow-lg shadow-slate-950/40">
                 <div className="mb-3">
                   <h3 className="text-base font-semibold">
                     Average by Fields
                   </h3>
                   <p className="text-xs text-slate-400">
                     Select one or more numeric fields to see their averages
                     for the filtered dataset.
                   </p>
                 </div>

                 <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_minmax(220px,260px)]">
                   {/* Left: selected fields averages in 2–3 columns */}
                   <div className="min-w-0">
                     {selectedAvgFields.length === 0 ? (
                       <p className="text-xs text-slate-500">
                         Choose at least one field from the list to see averages.
                       </p>
                     ) : averages.length === 0 ? (
                       <p className="text-xs text-slate-500">
                         No data available for the current filters.
                       </p>
                     ) : (
                       <div className="grid gap-3 grid-cols-2 xl:grid-cols-3">
                         {averages.map(({ field, average }) => {
                           const valueColor = fieldColors[field] ?? "#22d3ee";
                           return (
                             <div
                               key={field}
                               className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                             >
                               <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                                 {field}
                               </div>
                               <div className="mt-1 flex items-center gap-2">
                                 <div
                                   className="text-xl font-semibold"
                                   style={{ color: valueColor }}
                                 >
                                   {average !== null ? `${(average * 100).toFixed(2)}%` : "—"}
                                 </div>
                                 <label className="flex shrink-0 items-center" title="Set value color">
                                   <input
                                     type="color"
                                     value={valueColor}
                                     onChange={(e) =>
                                       setFieldColors((prev) => ({
                                         ...prev,
                                         [field]: e.target.value,
                                       }))
                                     }
                                     className="h-6 w-8 cursor-pointer rounded border border-slate-700 bg-slate-950 p-0.5"
                                   />
                                 </label>
                               </div>
                               <div className="mt-0.5 text-[11px] text-slate-500">
                                 Average across{" "}
                                 <span className="font-semibold text-slate-300">
                                   all
                                 </span>{" "}
                                 records
                               </div>
                             </div>
                           );
                         })}
                       </div>
                     )}
                   </div>

                   {/* Right: fields list */}
                   <div className="flex flex-col gap-1 text-xs">
                     <span className="font-medium text-slate-300">
                       Fields list
                     </span>
                     <div className="max-h-48 w-full min-w-0 space-y-1 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/80 p-2">
                       {numericFields.map((field) => {
                         const checked = selectedAvgFields.includes(field);
                         return (
                           <label
                             key={field}
                             className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-800/70"
                           >
                             <input
                               type="checkbox"
                               className="h-3 w-3 shrink-0 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                               checked={checked}
                               onChange={() =>
                                 toggleSelectedField(field, setSelectedAvgFields)
                               }
                             />
                             <span className="truncate" title={field}>
                               {field}
                             </span>
                           </label>
                         );
                       })}
                     </div>
                   </div>
                 </div>
               </div>

               {/* 2nd part: Time Series SSA-style decomposition */}
               <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/40">
                <div className="mb-3 grid gap-3 text-xs sm:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)] sm:items-end">
                  <div className="space-y-2">
                    <h3 className="text-base font-semibold">
                      Time Series SSA Decomposition
                    </h3>
                    <p className="text-xs text-slate-400">
                      Choose one field for the X-axis (timeline) and multiple
                      numeric fields for the Y-axis. Each Y field will be
                      plotted as a separate colored line.
                    </p>
                    <div className="flex flex-col gap-1">
                      <span className="font-medium text-slate-300">
                        X-axis field
                      </span>
                      <select
                        value={effectiveXAxisField ?? ""}
                        onChange={(e) =>
                          setSelectedXAxisField(
                            e.target.value === "" ? null : e.target.value
                          )
                        }
                        className="min-w-[180px] rounded-lg border border-slate-700 bg-slate-950 px-2 py-2 text-xs focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                      >
                        <option value="">Auto</option>
                        {allFieldNames.map((field) => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 text-xs">
                    <span className="font-medium text-slate-300">
                      Y-axis fields
                    </span>
                    <div className="max-h-32 w-full min-w-[220px] space-y-1 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/80 p-2">
                      {numericFields.map((field) => {
                        const checked = selectedSeriesFields.includes(field);
                        const seriesColor = fieldColors[field] ?? "#22d3ee";
                        return (
                          <div
                            key={field}
                            className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-800/70"
                          >
                            <label className="flex flex-1 cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                                checked={checked}
                                onChange={() =>
                                  toggleSelectedField(
                                    field,
                                    setSelectedSeriesFields
                                  )
                                }
                              />
                              <span className="truncate" title={field}>
                                {field}
                              </span>
                            </label>
                            <label
                              className="flex shrink-0 cursor-pointer"
                              title="Set line color"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="color"
                                value={seriesColor}
                                onChange={(e) =>
                                  setFieldColors((prev) => ({
                                    ...prev,
                                    [field]: e.target.value,
                                  }))
                                }
                                className="h-5 w-7 cursor-pointer rounded border border-slate-700 bg-slate-950 p-0.5"
                              />
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {selectedSeriesFields.length === 0 ? (
                   <p className="text-xs text-slate-500">
                     Choose one or more fields to plot the time series.
                   </p>
                 ) : filteredRows.length === 0 ? (
                   <p className="text-xs text-slate-500">
                     No data available for the current filters.
                   </p>
                 ) : (
                   <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/60">
                     <div className="h-[360px]">
                       <Plot
                         data={timeSeriesTraces}
                         layout={{
                           paper_bgcolor: "rgba(15,23,42,1)",
                           plot_bgcolor: "rgba(15,23,42,1)",
                           margin: { l: 56, r: 20, t: 40, b: 40 },
                           legend: {
                             orientation: "h",
                             yanchor: "bottom",
                             y: -0.2,
                             xanchor: "center",
                             x: 0.5,
                             font: { color: "#e2e8f0", size: 10 },
                           },
                           xaxis: {
                             title: "Timeline (Month)",
                             tickfont: { color: "#9ca3af", size: 10 },
                             titlefont: { color: "#e5e7eb", size: 11 },
                             gridcolor: "rgba(55,65,81,0.3)",
                           },
                           yaxis: {
                             title: "Percentage",
                             ticksuffix: "%",
                             tickfont: { color: "#9ca3af", size: 10 },
                             titlefont: { color: "#e5e7eb", size: 11 },
                             gridcolor: "rgba(55,65,81,0.3)",
                           },
                           font: {
                             family:
                               "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
                             color: "#e5e7eb",
                           },
                           showlegend: true,
                         }}
                         config={{
                           displayModeBar: true,
                           responsive: true,
                           displaylogo: false,
                         }}
                         style={{ width: "100%", height: "100%" }}
                         useResizeHandler
                       />
                     </div>
                   </div>
                 )}
               </div>
             </div>
           )}

           {activeTab === "visualizations" && (
             <VisualizationsTab
               filteredRows={filteredRows}
               numericFields={numericFields}
               fieldColors={fieldColors}
               setFieldColors={setFieldColors}
               vizShowCurve={vizShowCurve}
               setVizShowCurve={setVizShowCurve}
             />
           )}

           {activeTab === "geo" && (
             <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/40">
               <h3 className="text-base font-semibold mb-2">
                 Geo Sample (Coming Soon)
               </h3>
               <p className="text-xs text-slate-400">
                 Plug in your geographic information (lat/long, district,
                 constituency, etc.) here to render geo-level samples and maps
                 for the selected state. This panel is wired to the same state
                 and filters as the{" "}
                 <span className="font-semibold">Trends</span> and{" "}
                 <span className="font-semibold">Visualizations</span> tabs.
               </p>
             </div>
           )}
         </div>

         {/* Right: Filters */}
         <aside className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 shadow-lg shadow-slate-950/40">
           <h3 className="mb-2 text-sm font-semibold tracking-tight">
             Filters
           </h3>
          <p className="mb-2 text-xs text-slate-400">
            First choose which fields should be filterable, then select values
            for those fields. All charts and averages will respect these
            filters.
          </p>

          {allFieldNames.length === 0 ? (
            <p className="text-xs text-slate-500">
              No categorical fields available to filter.
            </p>
          ) : (
            <>
              <div className="mb-3 text-xs">
                <span className="font-medium text-slate-300">
                  Filter fields
                </span>
                <select
                  value=""
                  onChange={(e) => {
                    const value = e.target.value;
                    if (!value) return;
                    setSelectedFilterFields((prev) =>
                      prev.includes(value) ? prev : [...prev, value]
                    );
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-2 text-xs focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                >
                  <option value="">Select field to add…</option>
                  {allFieldNames.map((field) => (
                    <option key={field} value={field}>
                      {field}
                    </option>
                  ))}
                </select>
              </div>

              {selectedFilterFields.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Select at least one filter field above to configure filters.
                </p>
              ) : (
                <div className="space-y-3 text-xs">
                  {selectedFilterFields.map((field) => {
                 const valueSet = new Set<string>();
                 for (const row of allRows) {
                   const value = row[field];
                   if (
                     value !== undefined &&
                     value !== null &&
                     String(value).trim() !== ""
                   ) {
                     valueSet.add(String(value));
                   }
                 }
                 const values = Array.from(valueSet).sort();
                 const selectedValues = filters[field] ?? [];

                 if (values.length === 0) return null;

                 return (
                   <div
                     key={field}
                     className="rounded-lg border border-slate-800 bg-slate-950/60 p-2"
                   >
                     <div className="mb-1 flex items-center justify-between text-[11px] text-slate-300">
                        <span className="font-medium">{field}</span>
                       <button
                         type="button"
                          onClick={() => {
                            setFilters((prev) => ({
                              ...prev,
                              [field]: [],
                            }));
                            setSelectedFilterFields((prev) =>
                              prev.filter((f) => f !== field)
                            );
                          }}
                         className="text-cyan-400 hover:text-cyan-300"
                       >
                         Clear
                       </button>
                     </div>
                     <div className="max-h-40 space-y-1 overflow-y-auto rounded border border-slate-800 bg-slate-950/80 p-2">
                       {values.map((value) => {
                         const selected = selectedValues.includes(value);
                         return (
                           <label
                             key={value}
                             className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-800/70"
                           >
                             <input
                               type="checkbox"
                               className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                               checked={selected}
                               onChange={() =>
                                 handleToggleFilterValue(field, value)
                               }
                             />
                             <span className="truncate" title={value}>
                               {value}
                             </span>
                           </label>
                         );
                       })}
                     </div>
                   </div>
                );
              })}
                </div>
              )}
            </>
          )}

           {/* <div className="mt-4 rounded-lg border border-dashed border-slate-700 bg-slate-900/60 px-3 py-2 text-[11px] text-slate-400">
             <div className="mb-1 font-semibold text-slate-300">
               Filter summary
             </div>
             <div>
               <span className="font-semibold text-cyan-400">
                 {filteredRows.length}
               </span>{" "}
               records after filters (out of{" "}
               <span className="font-semibold">{allRows.length}</span> total for{" "}
               <span className="font-semibold">{selectedState}</span>).
             </div>
           </div> */}
         </aside>
       </section>
     </div>
   );
 };

 export default ReportsPage;

