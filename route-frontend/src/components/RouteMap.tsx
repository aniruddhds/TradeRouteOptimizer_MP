import { useEffect, useRef } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng, RouteResult, Stop } from "../types/route";

interface Props {
  depot: LatLng;
  stops: Stop[];
  routes: { result: RouteResult; color: string }[];
}

const BASELINE_COLOR = "#94a3b8";

export default function RouteMap({ depot, stops, routes }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView([depot.lat, depot.lng], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current, layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    const bounds = L.latLngBounds([[depot.lat, depot.lng]]);
    L.circleMarker([depot.lat, depot.lng], { radius: 9, color: "#166534", fillColor: "#166534", fillOpacity: 1 })
      .bindTooltip("Depot")
      .addTo(layer);

    stops.forEach((st, i) => {
      L.circleMarker([st.location.lat, st.location.lng], { radius: 6, color: "#334155", fillColor: "#fff", fillOpacity: 1, weight: 2 })
        .bindTooltip(`${i + 1}. ${st.name}`)
        .addTo(layer);
      bounds.extend([st.location.lat, st.location.lng]);
    });

    routes.forEach(({ result, color }) => {
      L.polyline(result.geometry, {
        color,
        weight: 4,
        opacity: 0.85,
        dashArray: color === BASELINE_COLOR ? "6 6" : undefined,
      }).addTo(layer);
    });

    if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
  }, [depot, stops, routes]);

  return <div ref={containerRef} className="h-[420px] w-full rounded-xl border border-slate-200" />;
}
