"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { revealTile } from "@/components/public-site/tile-reveal";

/**
 * Grille d'une section du catalogue. Les tuiles sont rendues au serveur (`children`) : les premières en
 * entier, les suivantes allégées (lien et nom, sans image ni halo). Seule cette grille est un composant
 * client : elle ajoute les images d'une tuile allégée à l'approche de l'écran, sans rien rendre elle-même.
 */
export function CatalogGrid({ sizes, children }: { sizes: string; children: ReactNode }) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          revealTile(entry.target as HTMLElement, sizes);
        }
      },
      { rootMargin: "800px 0px 800px 0px" },
    );
    for (const tile of list.querySelectorAll<HTMLElement>("li[data-thumb]")) observer.observe(tile);
    return () => observer.disconnect();
  }, [sizes]);

  return (
    <ul ref={listRef} className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {children}
    </ul>
  );
}
