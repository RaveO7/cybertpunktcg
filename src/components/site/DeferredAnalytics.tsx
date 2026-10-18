"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { whenIdle } from "@/components/CollectionProvider";

// Statistiques de visite et de performance de Vercel : chargées une fois la page affichée, pour ne pas
// retarder le démarrage. Speed Insights lit tout de même les mesures déjà enregistrées par le navigateur
// (premier affichage, plus grand élément, décalages de mise en page).
const Analytics = dynamic(() => import("@vercel/analytics/next").then((module) => module.Analytics), { ssr: false });
const SpeedInsights = dynamic(() => import("@vercel/speed-insights/next").then((module) => module.SpeedInsights), {
  ssr: false,
});

export function DeferredAnalytics() {
  const [idle, setIdle] = useState(false);
  useEffect(() => whenIdle(() => setIdle(true)), []);
  if (!idle) return null;
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
