"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapboxMap, MapMouseEvent } from "mapbox-gl";
import type { Glacier } from "@/lib/glacier-types";

const TOKEN =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN ??
  "pk.eyJ1IjoicmVzdHJ5IiwiYSI6ImNtcDdvb2Q2eDA0Y3UycnBzbzF2djZ0NDEifQ.-KHE5eGMYCwEPheVI8SdFg";

const GLIMS_RASTER_SOURCE_ID = "glims-world-outlines";
const GLIMS_RASTER_LAYER_ID = "glims-world-outlines-raster";

const GLACIER_SOURCE_ID = "glims-points-source";
const GLACIER_CLUSTER_LAYER_ID = "glims-clusters";
const GLACIER_CLUSTER_COUNT_LAYER_ID = "glims-cluster-count";
const GLACIER_POINT_LAYER_ID = "glims-point";
const GLACIER_SELECTED_LAYER_ID = "glims-point-selected";
const GLACIER_LABEL_LAYER_ID = "glims-label";

function riskColor(riesgo: number): string {
  if (riesgo >= 76) return "#ff3b3b";
  if (riesgo >= 51) return "#ff8a2a";
  if (riesgo >= 26) return "#46b8ff";
  return "#1dd38a";
}

function toFeatureCollection(glaciers: Glacier[], selectedId: string | undefined): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: glaciers.map((glacier) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [glacier.lon, glacier.lat] },
      properties: {
        id: glacier.id,
        glimsId: glacier.glimsId,
        name: glacier.name,
        riesgo: glacier.riesgo,
        color: riskColor(glacier.riesgo),
        selected: selectedId === glacier.id ? 1 : 0,
      },
    })),
  };
}

interface Props {
  glaciers: Glacier[];
  selected: Glacier | null;
  source: string | null;
  onSelect: (glacier: Glacier) => void;
  onViewportChange: (bbox: [number, number, number, number], zoom: number) => void;
}

export function GlacierMap({ glaciers, selected, source, onSelect, onViewportChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const onSelectRef = useRef(onSelect);
  const glaciersRef = useRef(glaciers);
  const [showWorldOutlines, setShowWorldOutlines] = useState(true);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    glaciersRef.current = glaciers;
  }, [glaciers]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let cancelled = false;
    let map: MapboxMap | null = null;

    import("mapbox-gl").then(({ default: mapboxgl }) => {
      if (cancelled) return;

      mapboxgl.accessToken = TOKEN;
      map = new mapboxgl.Map({
        container: element,
        style: "mapbox://styles/mapbox/dark-v11",
        center: [0, 18],
        zoom: 1.75,
        minZoom: 1.2,
        maxZoom: 14,
        attributionControl: false,
      });

      const emitViewport = () => {
        if (!map) return;
        const bounds = map.getBounds();
        onViewportChange(
          [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
          map.getZoom()
        );
      };

      map.on("style.load", () => {
        if (cancelled || !map) return;
        map.resize();
        map.setFog({
          color: "rgba(24, 58, 88, 0.18)",
          "high-color": "rgba(8, 11, 18, 0.98)",
          "horizon-blend": 0.14,
          "space-color": "rgb(3, 5, 9)",
          "star-intensity": 0.45,
        } as never);

        if (!map.getSource(GLIMS_RASTER_SOURCE_ID)) {
          map.addSource(GLIMS_RASTER_SOURCE_ID, {
            type: "raster",
            tiles: [
              "https://www.glims.org/geoserver/wms?service=WMS&version=1.1.0&request=GetMap&layers=GLIMS:GLIMS_Glacier_Outlines&styles=&bbox={bbox-epsg-3857}&width=256&height=256&srs=EPSG:3857&format=image/png&transparent=true",
            ],
            tileSize: 256,
          });
          map.addLayer({
            id: GLIMS_RASTER_LAYER_ID,
            type: "raster",
            source: GLIMS_RASTER_SOURCE_ID,
            paint: {
              "raster-opacity": 0.82,
              "raster-hue-rotate": 198,
              "raster-saturation": 0.95,
              "raster-brightness-min": 0.35,
              "raster-brightness-max": 1,
              "raster-contrast": 0.24,
            },
          });
        }

        if (!map.getSource(GLACIER_SOURCE_ID)) {
          map.addSource(GLACIER_SOURCE_ID, {
            type: "geojson",
            data: toFeatureCollection(glaciersRef.current, selected?.id),
            cluster: true,
            clusterRadius: 48,
            clusterMaxZoom: 8,
          });

          map.addLayer({
            id: GLACIER_CLUSTER_LAYER_ID,
            type: "circle",
            source: GLACIER_SOURCE_ID,
            filter: ["has", "point_count"],
            paint: {
              "circle-color": [
                "step",
                ["get", "point_count"],
                "rgba(70,184,255,0.28)",
                80,
                "rgba(70,184,255,0.38)",
                300,
                "rgba(29,211,138,0.35)",
              ],
              "circle-radius": [
                "step",
                ["get", "point_count"],
                14,
                80,
                18,
                300,
                22,
              ],
              "circle-stroke-color": "rgba(180,240,255,0.95)",
              "circle-stroke-width": 1.5,
            },
          });

          map.addLayer({
            id: GLACIER_CLUSTER_COUNT_LAYER_ID,
            type: "symbol",
            source: GLACIER_SOURCE_ID,
            filter: ["has", "point_count"],
            layout: {
              "text-field": "{point_count_abbreviated}",
              "text-size": 11,
              "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            },
            paint: {
              "text-color": "#e7f4ff",
              "text-halo-color": "rgba(0,0,0,0.8)",
              "text-halo-width": 1.2,
            },
          });

          map.addLayer({
            id: GLACIER_POINT_LAYER_ID,
            type: "circle",
            source: GLACIER_SOURCE_ID,
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 3, 5, 4.5, 8, 6],
              "circle-color": ["coalesce", ["get", "color"], "#46b8ff"],
              "circle-opacity": 0.9,
              "circle-stroke-color": "#ffffff",
              "circle-stroke-opacity": 0.75,
              "circle-stroke-width": 1,
            },
          });

          map.addLayer({
            id: GLACIER_SELECTED_LAYER_ID,
            type: "circle",
            source: GLACIER_SOURCE_ID,
            filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "selected"], 1]],
            paint: {
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 2, 8, 5, 10, 8, 12],
              "circle-color": "rgba(76, 196, 255, 0.26)",
              "circle-stroke-color": "#98e4ff",
              "circle-stroke-width": 2.4,
              "circle-stroke-opacity": 1,
            },
          });

          map.addLayer({
            id: GLACIER_LABEL_LAYER_ID,
            type: "symbol",
            source: GLACIER_SOURCE_ID,
            minzoom: 6,
            filter: ["!", ["has", "point_count"]],
            layout: {
              "text-field": ["slice", ["coalesce", ["get", "name"], ""], 0, 26],
              "text-size": 10,
              "text-offset": [0, 1.4],
              "text-anchor": "top",
              "text-allow-overlap": false,
              "text-ignore-placement": false,
            },
            paint: {
              "text-color": "#8fe6ff",
              "text-opacity": 0.9,
              "text-halo-color": "rgba(4,6,10,0.95)",
              "text-halo-width": 1.2,
            },
          });
        }

        const onClusterClick = (event: MapMouseEvent) => {
          if (!map) return;
          const features = map.queryRenderedFeatures(event.point, { layers: [GLACIER_CLUSTER_LAYER_ID] });
          const cluster = features[0];
          if (!cluster) return;

          const clusterId = cluster.properties?.cluster_id;
          const source = map.getSource(GLACIER_SOURCE_ID) as GeoJSONSource | undefined;
          if (!source || typeof clusterId !== "number") return;

          source.getClusterExpansionZoom(clusterId, (error, zoom) => {
            if (error || zoom === undefined || !map) return;
            const coordinates = (cluster.geometry as GeoJSON.Point).coordinates as [number, number];
            map.easeTo({ center: coordinates, zoom: Math.min(zoom + 0.2, 10), duration: 450 });
          });
        };

        const onPointClick = (event: MapMouseEvent) => {
          const feature = event.features?.[0];
          const id = feature?.properties?.id;
          if (!id) return;
          const glacier = glaciersRef.current.find((item) => item.id === id);
          if (glacier) onSelectRef.current(glacier);
        };

        map.on("click", GLACIER_CLUSTER_LAYER_ID, onClusterClick);
        map.on("click", GLACIER_POINT_LAYER_ID, onPointClick);
        map.on("mouseenter", GLACIER_CLUSTER_LAYER_ID, () => {
          map?.getCanvas().style.setProperty("cursor", "pointer");
        });
        map.on("mouseleave", GLACIER_CLUSTER_LAYER_ID, () => {
          map?.getCanvas().style.setProperty("cursor", "");
        });
        map.on("mouseenter", GLACIER_POINT_LAYER_ID, () => {
          map?.getCanvas().style.setProperty("cursor", "pointer");
        });
        map.on("mouseleave", GLACIER_POINT_LAYER_ID, () => {
          map?.getCanvas().style.setProperty("cursor", "");
        });

        map.on("moveend", emitViewport);
        emitViewport();
      });

      map.on("load", () => map?.resize());

      mapRef.current = map;
    });

    const observer = new ResizeObserver(() => {
      map?.resize();
    });
    observer.observe(element);

    return () => {
      cancelled = true;
      observer.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [onViewportChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource(GLACIER_SOURCE_ID)) return;
    const source = map.getSource(GLACIER_SOURCE_ID) as GeoJSONSource;
    source.setData(toFeatureCollection(glaciers, selected?.id));
  }, [glaciers, selected?.id]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(GLIMS_RASTER_LAYER_ID)) return;
    map.setLayoutProperty(GLIMS_RASTER_LAYER_ID, "visibility", showWorldOutlines ? "visible" : "none");
  }, [showWorldOutlines]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected) return;
    map.flyTo({
      center: [selected.lon, selected.lat],
      zoom: Math.max(6.5, map.getZoom()),
      duration: 900,
      essential: true,
    });
  }, [selected?.id]);

  return (
    <div className="absolute inset-0 h-full w-full overflow-hidden">
      <div
        ref={containerRef}
        className="absolute inset-0 h-full w-full [&_.mapboxgl-canvas]:!h-full [&_.mapboxgl-canvas]:!w-full [&_.mapboxgl-canvas-container]:!h-full [&_.mapboxgl-map]:!h-full"
      />

      <div className="absolute left-3 top-3 z-20 flex flex-col gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0a0d14]/88 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-cyan-200 backdrop-blur">
          Criosfera · Mundo
        </span>
        {source && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest text-emerald-300 backdrop-blur">
            GLIMS en vivo
          </span>
        )}
      </div>

      <div className="absolute right-3 top-3 z-20 flex flex-col items-end gap-1.5">
        <button
          onClick={() => setShowWorldOutlines((value) => !value)}
          className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest backdrop-blur transition-colors ${
            showWorldOutlines
              ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
              : "border-white/10 bg-[#0a0d14]/86 text-white/45"
          }`}
        >
          Contorno GLIMS
        </button>
      </div>
    </div>
  );
}
