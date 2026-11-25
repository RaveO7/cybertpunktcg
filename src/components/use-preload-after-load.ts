"use client";

import { useEffect } from "react";
import { whenIdle } from "@/lib/client/when-idle";

/**
 * Charge au repos, une fois la page chargée (événement load), le code d'une fenêtre importée à la demande
 * (next/dynamic) : le service worker ne garde que les fichiers déjà demandés, et la fenêtre doit pouvoir
 * s'ouvrir hors ligne. Attendre load le garde hors du premier affichage.
 */
export function usePreloadAfterLoad(load: () => Promise<unknown>) {
  useEffect(() => {
    let cancelIdle: (() => void) | undefined;
    const start = () => {
      cancelIdle = whenIdle(() => {
        // Échec sans risque (réseau coupé) : le code sera redemandé à l'ouverture de la fenêtre.
        load().catch(() => undefined);
      });
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      cancelIdle?.();
    };
  }, [load]);
}
