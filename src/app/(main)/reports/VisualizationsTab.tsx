"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";

type PlotlyData = Record<string, any>;
type PlotlyLayout = Record<string, any>;

const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
}) as React.ComponentType<any>;

type VisualizationsTabProps = {
  filteredRows: Record<string, unknown>[];
  numericFields: string[];
  fieldColors: Record<string, string>;
  setFieldColors: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  vizShowCurve: Record<string, boolean>;
  setVizShowCurve: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
};

function isNumeric(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function computeStats(values: number[]) {
  if (!values.length) {
    return {
      count: 0,
      mean: NaN,
      std: NaN,
      median: NaN,
      mode: [] as number[],
      skewness: NaN,
      min: NaN,
      max: NaN,
      q1: NaN,
      q3: NaN,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const count = values.length;
  const mean = values.reduce((acc, v) => acc + v, 0) / count;
  const variance =
    count > 1
      ? values.reduce((acc, v) => acc + (v - mean) * (v - mean), 0) / (count - 1)
      : 0;
  const std = Math.sqrt(variance);

  const quantile = (p: number) => {
    if (!sorted.length) return NaN;
    const idx = (sorted.length - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    const w = idx - lower;
    return sorted[lower] * (1 - w) + sorted[upper] * w;
  };

  const median = quantile(0.5);

  // Mode: values that appear most frequently (for continuous data, bin by rounded value)
  const freq = new Map<number, number>();
  for (const v of values) {
    const key = Math.round(v * 1e10) / 1e10; // avoid float key issues
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const maxFreq = Math.max(...freq.values());
  const mode = maxFreq > 1
    ? [...freq.entries()]
        .filter(([, c]) => c === maxFreq)
        .map(([k]) => k)
    : [];

  // Sample skewness (adjusted): (n / ((n-1)(n-2))) * sum(((x - mean) / std)^3)
  let skewness = NaN;
  if (count >= 3 && std > 0) {
    const factor = count / ((count - 1) * (count - 2));
    const sumCubes = values.reduce(
      (acc, v) => acc + Math.pow((v - mean) / std, 3),
      0
    );
    skewness = factor * sumCubes;
  }

  return {
    count,
    mean,
    std,
    median,
    mode,
    skewness,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    q1: quantile(0.25),
    q3: quantile(0.75),
  };
}

function buildNormalDistributionTrace(
  values: number[],
  field: string,
  opts: {
    histogramColor: string;
    curveColor: string;
    showCurve: boolean;
  }
): {
  data: PlotlyData[];
  layout: PlotlyLayout;
} {
  if (!values.length) {
    return {
      data: [],
      layout: {
        title: `Normal Distribution: ${field}`,
      },
    };
  }

  const stats = computeStats(values);
  const { mean, std, min, max } = stats;

  const rangeMin = Number.isFinite(min) ? min : mean - 3 * std;
  const rangeMax = Number.isFinite(max) ? max : mean + 3 * std;
  const span = rangeMax - rangeMin || 1;

  const data: PlotlyData[] = [
    {
      type: "histogram",
      x: values,
      name: "Observed",
      opacity: 0.6,
      marker: { color: opts.histogramColor },
      autobinx: true,
    },
  ];

  if (opts.showCurve) {
    const numPoints = 80;
    const xCurve: number[] = [];
    const yCurve: number[] = [];
    const binWidth = span / 20;
    const normFactor = 1 / (std || 1);
    for (let i = 0; i < numPoints; i++) {
      const x = rangeMin + (span * i) / (numPoints - 1);
      const z = (x - mean) / (std || 1);
      const pdf =
        (1 / Math.sqrt(2 * Math.PI)) * Math.exp(-0.5 * z * z);
      xCurve.push(x);
      yCurve.push(pdf * values.length * binWidth * normFactor);
    }
    data.push({
      type: "scatter",
      mode: "lines",
      x: xCurve,
      y: yCurve,
      name: "Fitted Normal",
      line: { color: opts.curveColor, width: 2 },
      hovertemplate:
        "x=%{x:.2f}<br>Density (scaled)=%{y:.2f}<extra>Normal fit</extra>",
    });
  }

  const layout: PlotlyLayout = {
    title: `Normal Distribution: ${field}`,
    bargap: 0.05,
    margin: { l: 56, r: 24, t: 40, b: 40 },
    paper_bgcolor: "rgba(15,23,42,1)",
    plot_bgcolor: "rgba(15,23,42,1)",
    xaxis: {
      title: field,
      gridcolor: "rgba(55,65,81,0.35)",
      tickfont: { color: "#9ca3af", size: 10 },
      titlefont: { color: "#e5e7eb", size: 11 },
    },
    yaxis: {
      title: "Frequency",
      gridcolor: "rgba(55,65,81,0.35)",
      tickfont: { color: "#9ca3af", size: 10 },
      titlefont: { color: "#e5e7eb", size: 11 },
    },
    legend: {
      font: { color: "#e5e7eb", size: 10 },
    },
    font: {
      family:
        "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
      color: "#e5e7eb",
    },
  };

  return { data, layout };
}

function buildBoxPlotTrace(
  values: number[],
  field: string,
  color: string = "#a855f7"
): {
  data: PlotlyData[];
  layout: PlotlyLayout;
} {
  const data: PlotlyData[] = [
    {
      type: "box",
      y: values,
      name: field,
      boxpoints: "outliers",
      marker: { color },
      line: { color: "#e5e7eb" },
      hovertemplate: `${field}<br>%{y:.2f}<extra></extra>`,
    },
  ];

  const layout: PlotlyLayout = {
    title: `Box Plot: ${field}`,
    margin: { l: 56, r: 24, t: 40, b: 32 },
    paper_bgcolor: "rgba(15,23,42,1)",
    plot_bgcolor: "rgba(15,23,42,1)",
    yaxis: {
      title: field,
      gridcolor: "rgba(55,65,81,0.35)",
      tickfont: { color: "#9ca3af", size: 10 },
      titlefont: { color: "#e5e7eb", size: 11 },
    },
    xaxis: {
      tickfont: { color: "#9ca3af", size: 10 },
    },
    font: {
      family:
        "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
      color: "#e5e7eb",
    },
  };

  return { data, layout };
}

export const VisualizationsTab: React.FC<VisualizationsTabProps> = ({
  filteredRows,
  numericFields,
  fieldColors,
  setFieldColors,
  vizShowCurve,
  setVizShowCurve,
}) => {
  const [selectedFields, setSelectedFields] = useState<string[]>([]);

  const fieldValues = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const field of numericFields) {
      const values: number[] = [];
      for (const row of filteredRows) {
        const value = row[field];
        if (isNumeric(value)) {
          values.push(value);
        }
      }
      map.set(field, values);
    }
    return map;
  }, [filteredRows, numericFields]);

  const toggleField = (field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  };

  const visibleFields = selectedFields.filter((field) => fieldValues.get(field)?.length);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-950/40">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">Distributions & Box Plots</h3>
            <p className="text-xs text-slate-400">
              Select one or more numeric fields to generate normal distribution
              histograms and box plots. All charts respect the current filters and
              selected state.
            </p>
          </div>
          <div className="flex flex-col gap-1 text-xs sm:w-72">
            <span className="font-medium text-slate-300">Numeric fields</span>
            <div className="max-h-40 w-full space-y-1 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950/80 p-2">
              {numericFields.length === 0 ? (
                <p className="text-xs text-slate-500">
                  No numeric fields detected for the current selection.
                </p>
              ) : (
                numericFields.map((field) => {
                  const checked = selectedFields.includes(field);
                  const count = fieldValues.get(field)?.length ?? 0;
                  return (
                    <label
                      key={field}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-slate-800/70"
                    >
                      <input
                        type="checkbox"
                        className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                        checked={checked}
                        disabled={count === 0}
                        onChange={() => toggleField(field)}
                      />
                      <span className="flex-1 truncate" title={field}>
                        {field}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {count} pts
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {visibleFields.length === 0 ? (
          <p className="text-xs text-slate-500">
            Choose at least one numeric field with data to see its distribution and
            box plot.
          </p>
        ) : (
          <div className="space-y-4">
            {visibleFields.map((field) => {
              const values = fieldValues.get(field) ?? [];
              const stats = computeStats(values);
              const histogramColor = fieldColors[field] ?? "#22d3ee";
              const curveColor = fieldColors[`${field}_curve`] ?? "#f97316";
              const showCurve = vizShowCurve[field] !== false;
              const { data: normalData, layout: normalLayout } =
                buildNormalDistributionTrace(values, field, {
                  histogramColor,
                  curveColor,
                  showCurve,
                });
              const { data: boxData, layout: boxLayout } = buildBoxPlotTrace(
                values,
                field,
                histogramColor
              );

              return (
                <div
                  key={field}
                  className="rounded-lg border border-slate-800 bg-slate-950/80 p-3"
                >
                  <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-50">
                        {field}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Normal distribution approximation and box plot for the
                        filtered dataset.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <label className="flex items-center gap-1.5 text-slate-300">
                        <span>Histogram</span>
                        <input
                          type="color"
                          value={histogramColor}
                          onChange={(e) =>
                            setFieldColors((prev) => ({
                              ...prev,
                              [field]: e.target.value,
                            }))
                          }
                          className="h-6 w-8 cursor-pointer rounded border border-slate-700 bg-slate-950 p-0.5"
                          title="Histogram color"
                        />
                      </label>
                      <label className="flex items-center gap-1.5 text-slate-300">
                        <span>Curve</span>
                        <input
                          type="color"
                          value={curveColor}
                          onChange={(e) =>
                            setFieldColors((prev) => ({
                              ...prev,
                              [`${field}_curve`]: e.target.value,
                            }))
                          }
                          className="h-6 w-8 cursor-pointer rounded border border-slate-700 bg-slate-950 p-0.5"
                          title="Curve color"
                        />
                      </label>
                      <label className="flex cursor-pointer items-center gap-2 text-slate-300">
                        <input
                          type="checkbox"
                          className="h-3 w-3 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                          checked={showCurve}
                          onChange={(e) =>
                            setVizShowCurve((prev) => ({
                              ...prev,
                              [field]: e.target.checked,
                            }))
                          }
                        />
                        Show fitted curve
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-slate-400 sm:grid-cols-3 lg:grid-cols-6">
                      {/* <div>
                        <div className="text-slate-500">Count</div>
                        <div className="font-semibold text-slate-100">
                          {stats.count}
                        </div>
                      </div> */}
                      <div>
                        <div className="text-slate-500">Mean</div>
                        <div className="font-semibold text-cyan-300">
                          {Number.isFinite(stats.mean)
                            ? `${(stats.mean * 100).toFixed(2)}%`
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Std dev</div>
                        <div className="font-semibold text-amber-300">
                          {Number.isFinite(stats.std)
                            ? stats.std.toFixed(2)
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Median</div>
                        <div className="font-semibold text-emerald-300">
                          {Number.isFinite(stats.median)
                            ? `${(stats.median * 100).toFixed(2)}%`
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Mode</div>
                        <div className="font-semibold text-violet-300">
                          {stats.mode.length > 0
                            ? stats.mode.length <= 3
                              ? stats.mode.map((m) => `${(m * 100).toFixed(2)}%`).join(", ")
                              : `${stats.mode.slice(0, 2).map((m) => `${(m * 100).toFixed(2)}%`).join(", ")} (+${stats.mode.length - 2})`
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500">Skewness</div>
                        <div className="font-semibold text-rose-300">
                          {Number.isFinite(stats.skewness)
                            ? `${(stats.skewness * 100).toFixed(3)}%`
                            : "—"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                    <div className="overflow-hidden rounded border border-slate-800 bg-slate-950/70">
                      <div className="h-[260px]">
                        {normalData.length === 0 ? (
                          <div className="flex h-full items-center justify-center text-xs text-slate-500">
                            Not enough data to compute distribution.
                          </div>
                        ) : (
                          <Plot
                            data={normalData}
                            layout={normalLayout}
                            config={{
                              displayModeBar: true,
                              responsive: true,
                              displaylogo: false,
                            }}
                            style={{ width: "100%", height: "100%" }}
                            useResizeHandler
                          />
                        )}
                      </div>
                    </div>

                    <div className="overflow-hidden rounded border border-slate-800 bg-slate-950/70">
                      <div className="h-[260px]">
                        <Plot
                          data={boxData}
                          layout={boxLayout}
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
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

