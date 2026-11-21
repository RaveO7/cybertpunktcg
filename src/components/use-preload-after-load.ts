"use client";

import { useEffect } from "react";
import { whenIdle } from "@/components/CollectionProvider";

// Délai après load : un préchargement terminé avant le plus grand affichage (image de carte, ~0,9 s sur
// mobile) est compté par Lighthouse dans son LCP simulé, ce qui faisait reculer la note de la collection.
const PRELOAD_DELAY_MS = 5000;

/**
 * Charge au repos, quelques secondes après le chargement de la page (événement load), le code d'une
 * fenêtre importée à la demande (next/dynamic) : le service worker ne garde que les fichiers déjà demandés,
 * et la fenêtre doit pouvoir s'ouvrir hors ligne. Ce délai le garde hors du premier affichage.
 */
export function usePreloadAfterLoad(load: () => Promise<unknown>) {
  useEffect(() => {
    let cancelIdle: (() => void) | undefined;
    let timer: number | undefined;
    const start = () => {
      timer = window.setTimeout(() => {
        cancelIdle = whenIdle(() => {
          // Échec sans risque (réseau coupé) : le code sera redemandé à l'ouverture de la fenêtre.
          load().catch(() => undefined);
        });
      }, PRELOAD_DELAY_MS);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      window.clearTimeout(timer);
      cancelIdle?.();
    };
  }, [load]);
}
