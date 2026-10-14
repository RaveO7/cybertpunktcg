"use client";

import { useEffect } from "react";

/** Délai entre deux glitchs d'un même élément : aléatoire, 30 s au plus. */
const MIN_DELAY_MS = 6000;
const MAX_DELAY_MS = 30000;
/** Durée de l'effet (cf. .cp-glitch.is-glitching dans globals.css). */
const GLITCH_MS = 900;
/** Élément hors écran ou onglet masqué : nouvel essai peu après, pour qu'on le voie. */
const RETRY_MS = 2500;

function randomDelay(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function onScreen(element: Element) {
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0;
}

/**
 * Déclenche au hasard l'effet glitch des éléments marqués `data-glitch="<nom>"` (titres .cp-glitch,
 * blocs .cp-glitch-block). Chaque nom a son propre minuteur ; l'élément est recherché à chaque
 * déclenchement, car certains sont remplacés au fil du rendu (titre du module du carrousel).
 * Le premier glitch de chaque titre a lieu à son apparition (RevealDirector). Rien si l'utilisateur
 * préfère réduire les animations.
 */
export function GlitchDirector() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers = new Map<string, number>();
    const names = [...new Set([...document.querySelectorAll<HTMLElement>("[data-glitch]")].map((element) => element.dataset.glitch!))];

    function schedule(name: string, delay: number) {
      timers.set(name, window.setTimeout(() => fire(name), delay));
    }

    function fire(name: string) {
      const element = document.querySelector<HTMLElement>(`[data-glitch="${CSS.escape(name)}"]`);
      if (!element) return;
      if (document.hidden || !onScreen(element)) {
        schedule(name, RETRY_MS);
        return;
      }
      element.classList.remove("is-glitching");
      // Relance l'animation même si la classe vient d'être retirée.
      void element.offsetWidth;
      element.classList.add("is-glitching");
      window.setTimeout(() => element.classList.remove("is-glitching"), GLITCH_MS);
      schedule(name, randomDelay(MIN_DELAY_MS, MAX_DELAY_MS));
    }

    for (const name of names) schedule(name, randomDelay(MIN_DELAY_MS, MAX_DELAY_MS));
    return () => {
      for (const id of timers.values()) window.clearTimeout(id);
    };
  }, []);

  return null;
}
