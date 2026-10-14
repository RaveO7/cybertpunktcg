"use client";

import { useEffect } from "react";

/** Durée de l'effet glitch déclenché à l'apparition d'un titre (cf. .cp-glitch.is-glitching). */
const GLITCH_MS = 900;

/**
 * Apparition au défilement des blocs marqués `data-reveal` (« up », « left », « right », « fade »,
 * « bar », « wipe », cf. globals.css) : chacun se révèle une fois, quand il entre à l'écran, avec le
 * décalage `--reveal-delay` éventuel. Un titre .cp-glitch glitche en apparaissant (y compris ceux du
 * haut de page, `data-intro`, qui apparaissent en CSS seul).
 * Sans JavaScript, ou si ce composant ne prend pas le relais, rien n'est masqué (filet de 4 s du
 * script inline, cf. reveal-boot.ts) ; avec « réduire les animations » non plus (règles CSS sous
 * prefers-reduced-motion).
 */
export function RevealDirector() {
  useEffect(() => {
    const root = document.documentElement;
    // Navigation côté client vers l'accueil : la classe a pu être retirée en quittant la page.
    root.classList.add("reveal-ready", "reveal-active");
    const timers: number[] = [];

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;
          element.classList.add("is-revealed");
          observer.unobserve(element);
          const glitch = element.matches(".cp-glitch") ? element : element.querySelector<HTMLElement>(".cp-glitch");
          if (glitch) {
            const delay = Number.parseInt(getComputedStyle(element).getPropertyValue("--reveal-delay"), 10) || 0;
            timers.push(
              window.setTimeout(() => {
                glitch.classList.add("is-glitching");
                timers.push(window.setTimeout(() => glitch.classList.remove("is-glitching"), GLITCH_MS));
              }, delay + 250),
            );
          }
        }
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" },
    );
    // Haut de page (data-intro) : déjà visible, seul le glitch d'apparition le concerne.
    for (const element of document.querySelectorAll("[data-reveal], [data-intro]")) observer.observe(element);

    return () => {
      observer.disconnect();
      for (const id of timers) window.clearTimeout(id);
      root.classList.remove("reveal-ready", "reveal-active");
    };
  }, []);

  return null;
}
