"use client";

import dynamic from "next/dynamic";
import type { MapViewProps } from "./MapView";

/** Leaflet manipule le DOM : la carte n'est jamais rendue côté serveur. */
const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse border border-line bg-panel" />,
});

export function LazyMap(props: MapViewProps) {
  return <MapView {...props} />;
}

export type { MapItem, MapMarker } from "./MapView";
