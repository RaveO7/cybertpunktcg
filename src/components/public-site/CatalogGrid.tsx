"use client";

import { useEffect, useRef, useState } from "react";
import { CatalogCardTile, type TileCard } from "@/components/public-site/CatalogCardTile";

/** Tuiles affichées en entier par paquet (images, halos). */
export const CATALOG_BATCH = 20;

/**
 * Grille d'une section du catalogue, allégée : toutes les cartes sont dans le HTML (lien et nom, pour les
 * moteurs et sans JS), mais seules les `initial` premières ont leur image et leurs halos ; les suivantes
 * passent en tuile complète par paquets, à l'approche de l'écran. Même cadre dans les deux cas : rien ne bouge.
 */
export function CatalogGrid({ cards, sizes, initial, eager }: { cards: TileCard[]; sizes: string; initial: number; eager: number }) {
  const [shown, setShown] = useState(initial);
  const listRef = useRef<HTMLUListElement>(null);

  // Observe la première tuile allégée ; ré-observée après chaque paquet, tant qu'elle reste proche la suite arrive.
  useEffect(() => {
    const next = listRef.current?.children[shown];
    if (!next || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setShown((count) => Math.max(count, shown + CATALOG_BATCH));
      },
      { rootMargin: "800px 0px 800px 0px" },
    );
    observer.observe(next);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <ul ref={listRef} className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {cards.map((card, index) => (
        <CatalogCardTile key={card.slug} card={card} sizes={sizes} eager={index < eager} light={index >= shown} />
      ))}
    </ul>
  );
}
