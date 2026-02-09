"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

interface GeoSample {
  id: string;
  state: string;
  YOE: string;
  location: string;
  pincode: string;
  date: string;
  value: string;
  district: string;
  latitude: number;
  longitude: number;
  geom?: string;
  geom_geojson?: {
    type: "Point";
    coordinates: [number, number];
  };
}

const GEO_API = process.env.NEXT_PUBLIC_GEO_API ?? "/api/geo";
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

// India center
const INDIA_CENTER: [number, number] = [78.9629, 20.5937];
const INDIA_ZOOM = 4;

// State bounds for zooming to selected state
const STATE_BOUNDS: Record<string, { center: [number, number]; zoom: number }> = {
  "Andhra Pradesh": { center: [79.5941, 15.9129], zoom: 7 },
  "Arunachal Pradesh": { center: [93.6053, 28.2180], zoom: 6 },
  "Assam": { center: [92.9375, 26.2006], zoom: 7 },
  "Bihar": { center: [85.3140, 25.0961], zoom: 7 },
  "Chhattisgarh": { center: [84.0855, 21.2787], zoom: 7 },
  "Goa": { center: [73.8278, 15.2993], zoom: 8 },
  "Gujarat": { center: [72.6369, 22.2587], zoom: 7 },
  "Haryana": { center: [77.0266, 29.0588], zoom: 8 },
  "Himachal Pradesh": { center: [77.1734, 31.7433], zoom: 7 },
  "Jharkhand": { center: [85.2799, 23.6102], zoom: 7 },
  "Karnataka": { center: [75.7139, 15.3173], zoom: 7 },
  "Kerala": { center: [76.2711, 10.8505], zoom: 7 },
  "Madhya Pradesh": { center: [78.6569, 22.9375], zoom: 6 },
  "Maharashtra": { center: [75.7139, 19.7515], zoom: 7 },
  "Manipur": { center: [94.7822, 24.6637], zoom: 7 },
  "Meghalaya": { center: [91.8960, 25.4670], zoom: 8 },
  "Mizoram": { center: [93.2891, 23.1645], zoom: 7 },
  "Nagaland": { center: [94.5623, 26.1584], zoom: 7 },
  "Odisha": { center: [85.0980, 20.9517], zoom: 7 },
  "Punjab": { center: [75.5762, 31.1471], zoom: 7 },
  "Rajasthan": { center: [75.8245, 27.0238], zoom: 6 },
  "Sikkim": { center: [88.5122, 27.5330], zoom: 8 },
  "Tamil Nadu": { center: [78.6829, 11.1271], zoom: 7 },
  "Telangana": { center: [78.4740, 18.1124], zoom: 7 },
  "Tripura": { center: [91.9455, 23.9408], zoom: 8 },
  "Uttar Pradesh": { center: [79.0193, 26.8467], zoom: 6 },
  "Uttarakhand": { center: [79.8711, 30.0668], zoom: 7 },
  "West Bengal": { center: [88.3639, 24.7433], zoom: 7 },
};

// Value -> color palette (reference style: red, blue, grey, etc.)
const VALUE_COLORS: Record<string, string> = {
  TDP: "#dc2626",
  YSRCP: "#2563eb",
  JSP: "#64748b",
  INC: "#ea580c",
  BJP: "#7c3aed",
  default: "#94a3b8",
};
const COLOR_ORDER = ["#dc2626", "#2563eb", "#64748b", "#ea580c", "#7c3aed", "#0891b2", "#16a34a"];

function getColorForValue(value: string, index: number): string {
  return VALUE_COLORS[value] ?? COLOR_ORDER[index % COLOR_ORDER.length] ?? VALUE_COLORS.default;
}

function buildGeoJson(
  data: GeoSample[],
  valueToColor: Map<string, string>
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: data
      .filter((d) => d.latitude != null && d.longitude != null)
      .map((d) => ({
        type: "Feature" as const,
        geometry: d.geom_geojson ?? {
          type: "Point" as const,
          coordinates: [d.longitude, d.latitude],
        },
        properties: {
          id: d.id,
          state: d.state,
          YOE: d.YOE,
          location: d.location,
          value: d.value,
          district: d.district,
          color: valueToColor.get(d.value) ?? VALUE_COLORS.default,
        },
      })),
  };
}

export default function Geo() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<InstanceType<typeof mapboxgl.Map> | null>(null);
  const [data, setData] = useState<GeoSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState("");
  const [yoeFilter, setYoeFilter] = useState("");
  const [valueFilter, setValueFilter] = useState("");
  const [filterOptions, setFilterOptions] = useState<{
    states: string[];
    yoeValues: string[];
    valueOptions: string[];
  }>({ states: [], yoeValues: [], valueOptions: [] });
  const [mapReady, setMapReady] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (stateFilter) params.set("state", stateFilter);
      if (yoeFilter) params.set("YOE", yoeFilter);
      if (valueFilter) params.set("value", valueFilter);
      const url = params.toString() ? `${GEO_API}?${params}` : GEO_API;
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg =
          (body?.error as string) ||
          (body?.detail ? JSON.stringify(body.detail) : null) ||
          `Failed to fetch (${res.status})`;
        throw new Error(msg);
      }
      const rows: GeoSample[] = await res.json();
      setData(rows);
      if (!stateFilter && !yoeFilter && !valueFilter) {
        setFilterOptions({
          states: [...new Set(rows.map((d) => d.state).filter(Boolean))].sort(),
          yoeValues: [...new Set(rows.map((d) => d.YOE).filter(Boolean))].sort(),
          valueOptions: [...new Set(rows.map((d) => d.value).filter(Boolean))].sort(),
        });
      }
      return rows;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const isBackendDown =
        message.includes("fetch") ||
        message.includes("Failed to fetch") ||
        message.includes("NetworkError");
      setError(
        isBackendDown
          ? "Backend unavailable. Start the Express server on port 5000 and try again."
          : message
      );
      setData([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [stateFilter, yoeFilter, valueFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Map init
  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    const mapInstance = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: INDIA_CENTER,
      zoom: INDIA_ZOOM,
      projection: 'globe',
      attributionControl: false,
    });

    mapInstance.on('style.load', () => {
    mapInstance.setFog({
        'range': [0.5, 10],
        'color': '#24242e',
        'high-color': '#24242e',
        'space-color': '#000000',
        'star-intensity': 0.5
    });
});

    mapInstance.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    mapInstance.addControl(new mapboxgl.FullscreenControl(), "bottom-right");

    mapInstance.on("load", () => {
      mapInstance.resize();
      setMapReady(true);
    });

    map.current = mapInstance;

    return () => {
      mapInstance.remove();
      map.current = null;
      setMapReady(false);
    };
  }, []);

  // Handle map zoom/rotation when state filter changes
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady) return;

    if (stateFilter && STATE_BOUNDS[stateFilter]) {
      const { center, zoom } = STATE_BOUNDS[stateFilter];
      m.flyTo({
        center: center,
        zoom: zoom,
        duration: 1500,
        essential: true,
      });
    } else if (!stateFilter) {
      // Reset to India view when no state is selected
      m.flyTo({
        center: INDIA_CENTER,
        zoom: INDIA_ZOOM,
        duration: 1500,
        essential: true,
      });
    }
  }, [stateFilter, mapReady]);

  // Update GeoJSON source when data changes
  useEffect(() => {
    const m = map.current;
    if (!m || !mapReady) return;

    const valueToColor = new Map<string, string>();
    filterOptions.valueOptions.forEach((v, i) => valueToColor.set(v, getColorForValue(v, i)));
    const geoJson = buildGeoJson(data, valueToColor);

    const addOrUpdateLayers = () => {
      if (m.getLayer("geo-cluster-count")) m.removeLayer("geo-cluster-count");
      if (m.getLayer("geo-clusters")) m.removeLayer("geo-clusters");
      if (m.getLayer("geo-points")) m.removeLayer("geo-points");
      if (m.getSource("geo-points")) m.removeSource("geo-points");

      m.addSource("geo-points", {
        type: "geojson",
        data: geoJson,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 40,
      });

      m.addLayer({
        id: "geo-points",
        type: "circle",
        source: "geo-points",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": ["coalesce", ["get", "color"], "#94a3b8"],
          "circle-radius": 8,
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(255,255,255,0.6)",
        },
      });

      m.addLayer({
        id: "geo-clusters",
        type: "circle",
        source: "geo-points",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#64748b", 10, "#475569", 30, "#334155"],
          "circle-radius": ["step", ["get", "point_count"], 15, 10, 20, 30, 25],
          "circle-stroke-width": 2,
          "circle-stroke-color": "rgba(255,255,255,0.6)",
        },
      });

      m.addLayer({
        id: "geo-cluster-count",
        type: "symbol",
        source: "geo-points",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#fff",
        },
      });

      m.off("click", "geo-points");
      m.off("click", "geo-clusters");
      m.on(
        "click",
        "geo-points",
        (e: {
          features?: {
            geometry: GeoJSON.Point;
            properties: Record<string, string>;
          }[];
          lngLat: { lng: number; lat: number };
        }) => {
          if (!e.features?.[0]) return;
          const props = e.features[0].properties as Record<string, string>;
          const coords = (e.features[0].geometry as GeoJSON.Point).coordinates.slice() as [
            number,
            number,
          ];
          while (Math.abs(e.lngLat.lng - coords[0]) > 180)
            coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
          new mapboxgl.Popup()
            .setLngLat(coords)
            .setHTML(
              `<div class="text-sm text-zinc-900">
                <strong>${props.location ?? ""}</strong>, ${props.district ?? ""}<br/>
                State: ${props.state ?? ""}<br/>
                YOE: ${props.YOE ?? ""}<br/>
                Value: ${props.value ?? ""}
              </div>`
            )
            .addTo(m);
        }
      );

      m.on("click", "geo-clusters", (e: { point: { x: number; y: number } }) => {
        const features = m.queryRenderedFeatures(e.point, { layers: ["geo-clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        if (clusterId == null) return;
        const source = m.getSource("geo-points") as {
          getClusterExpansionZoom: (
            id: number,
            cb: (err: Error | null, zoom?: number) => void
          ) => void;
        };
        source.getClusterExpansionZoom(clusterId, (err: Error | null, zoom?: number) => {
          if (err) return;
          const geometry = features[0]?.geometry as GeoJSON.Point;
          const coords = geometry.coordinates as [number, number];
          m.easeTo({ center: coords, zoom: zoom ?? m.getZoom() });
        });
      });
    };

    if (m.isStyleLoaded()) {
      addOrUpdateLayers();
    } else {
      m.once("load", addOrUpdateLayers);
    }
  }, [data, filterOptions.valueOptions, mapReady]);

  if (!MAPBOX_TOKEN) {
    return (
      <div className="p-4 text-amber-600">
        Add <code className="bg-amber-100 px-1">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> to your{" "}
        <code className="bg-amber-100 px-1">.env.local</code> to display the map.
      </div>
    );
  }

  const { states, yoeValues, valueOptions } = filterOptions;

  const errorBanner = error ? (
    <div className="flex items-center justify-between gap-4 px-4 py-3 bg-amber-900/80 border-b border-amber-600 text-amber-100">
      <span>{error}</span>
      <button
        type="button"
        onClick={() => {
          setError(null);
          fetchData();
        }}
        className="shrink-0 px-3 py-1.5 text-sm font-medium bg-amber-700 hover:bg-amber-600 rounded"
      >
        Retry
      </button>
    </div>
  ) : null;

  if (error && data.length === 0) {
    return (
      <div className="fixed inset-0 flex flex-col bg-zinc-900">
        {errorBanner}
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-zinc-400 text-center">
            The map will appear once geo data is available.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-zinc-900">
      {errorBanner}
      {/* Title overlay - top left */}
      <div className="absolute top-4 left-4 z-10 max-w-md bg-zinc-900/90 backdrop-blur rounded-lg border border-zinc-700 p-4">
      <h1 className="text-lg font-semibold text-green-500 drop-shadow">
          Reachout Analytics
        </h1>
        <h1 className="text-lg font-semibold text-white drop-shadow">
          India – Geo Data by Location
        </h1>
        <p className="text-sm text-zinc-400 mt-0.5">
          Points colored by value. Use filters to explore.
        </p>
      </div>

      {/* Map - full viewport */}
      <div
        ref={mapContainer}
        className="absolute inset-0 w-full h-full"
        style={{ minHeight: "400px" }}
      />

      {/* Sidebar - right side (reference style) */}
      <div className="absolute top-12 right-4 bottom-4 z-10 w-56 flex flex-col gap-4">
        {/* Legend */}
        <div className="bg-zinc-900/90 backdrop-blur rounded-lg border border-zinc-700 p-4">
          <h3 className="text-sm font-medium text-white mb-3">Value by location</h3>
          <div className="space-y-2">
            {valueOptions.map((v, i) => (
              <div key={v} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: getColorForValue(v, i) }}
                />
                <span className="text-xs text-zinc-300 truncate">{v}</span>
              </div>
            ))}
            {valueOptions.length === 0 && (
              <p className="text-xs text-zinc-500">No values yet</p>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-zinc-900/90 backdrop-blur rounded-lg border border-zinc-700 p-4 flex-1 min-h-0 overflow-auto">
          <h3 className="text-sm font-medium text-white mb-3">Filters</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">State</label>
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-white"
              >
                <option value="">All states</option>
                {states.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">YOE</label>
              <select
                value={yoeFilter}
                onChange={(e) => setYoeFilter(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-white"
              >
                <option value="">All</option>
                {yoeValues.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Value</label>
              <select
                value={valueFilter}
                onChange={(e) => setValueFilter(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-sm text-white"
              >
                <option value="">All</option>
                {valueOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-3">
            {loading ? "Loading…" : `${data.length} point(s)`}
          </p>
        </div>
      </div>
    </div>
  );
}
