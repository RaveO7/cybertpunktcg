"use client";

// Carte Leaflet + tuiles OpenStreetMap (fournisseur configurable). Chargée uniquement côté
// client (voir LazyMap). Repères en HTML/CSS, sans images : rien à résoudre par le bundler.

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef } from "react";

export type MapItem = { label: string; href: string; detail?: string };
export type MapMarker = { lat: number; lng: number; items: MapItem[]; highlight?: boolean };

const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

function markerIcon(count: number, highlight: boolean) {
  const color = highlight ? "var(--color-yellow, #f3e600)" : "var(--color-cyan, #00f0ff)";
  return L.divIcon({
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
    html: `<span style="display:flex;width:26px;height:26px;align-items:center;justify-content:center;background:#07080d;border:2px solid ${color};color:${color};font:600 12px/1 var(--font-geist-mono, monospace);clip-path:polygon(0 0,100% 0,100% 75%,50% 100%,0 75%)">${count > 1 ? count : ""}</span>`,
  });
}

function popupHtml(items: MapItem[]) {
  return items
    .map(
      (item) =>
        `<a href="${escapeHtml(item.href)}" style="display:block;margin:2px 0;font-weight:600">${escapeHtml(item.label)}</a>` +
        (item.detail ? `<span style="display:block;font-size:11px;opacity:.75">${escapeHtml(item.detail)}</span>` : ""),
    )
    .join("");
}

/** Regroupe les repères qui partagent exactement le même emplacement (même boutique). */
export function groupMarkers(markers: MapMarker[]): MapMarker[] {
  const groups = new Map<string, MapMarker>();
  for (const marker of markers) {
    const key = `${marker.lat.toFixed(5)}:${marker.lng.toFixed(5)}`;
    const group = groups.get(key);
    if (group) {
      group.items.push(...marker.items);
      group.highlight ||= marker.highlight;
    } else {
      groups.set(key, { ...marker, items: [...marker.items] });
    }
  }
  return [...groups.values()];
}

export type MapViewProps = {
  markers: MapMarker[];
  /** Centre et zoom quand il n'y a pas de repère (ou un seul). */
  center?: { lat: number; lng: number };
  zoom?: number;
  /** Cercle de recherche (rayon en km). */
  circle?: { lat: number; lng: number; radiusKm: number } | null;
  label: string;
  className?: string;
};

export default function MapView({ markers, center, zoom = 13, circle, label, className = "h-80" }: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = L.map(container.current, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 19 }).addTo(instance);
    layer.current = L.layerGroup().addTo(instance);
    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
      layer.current = null;
    };
  }, []);

  useEffect(() => {
    const instance = map.current;
    const group = layer.current;
    if (!instance || !group) return;
    group.clearLayers();
    const grouped = groupMarkers(markers);
    const bounds: L.LatLngTuple[] = [];
    for (const marker of grouped) {
      L.marker([marker.lat, marker.lng], { icon: markerIcon(marker.items.length, Boolean(marker.highlight)), title: marker.items[0]?.label })
        .bindPopup(popupHtml(marker.items))
        .addTo(group);
      bounds.push([marker.lat, marker.lng]);
    }
    if (circle) {
      L.circle([circle.lat, circle.lng], { radius: circle.radiusKm * 1000, color: "#00f0ff", weight: 1, fillOpacity: 0.05 }).addTo(group);
      // Emprise calculée sans la carte : Circle.getBounds() exige une vue déjà en place.
      instance.fitBounds(L.latLng(circle.lat, circle.lng).toBounds(circle.radiusKm * 2000), { padding: [16, 16] });
    } else if (bounds.length > 1) {
      instance.fitBounds(bounds, { padding: [32, 32], maxZoom: 14 });
    } else if (bounds.length === 1) {
      instance.setView(bounds[0], zoom);
    } else if (center) {
      instance.setView([center.lat, center.lng], zoom);
    } else {
      // France métropolitaine par défaut.
      instance.setView([46.6, 2.4], 5);
    }
  }, [markers, center, zoom, circle]);

  return <div ref={container} role="region" aria-label={label} className={`z-0 w-full border border-line ${className}`} />;
}
