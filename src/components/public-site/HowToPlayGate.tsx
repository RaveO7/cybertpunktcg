"use client";

import type { ReactNode } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { HowToPlayScreen } from "@/components/HowToPlayScreen";

/**
 * « Comment jouer » : règles complètes et parcours interactif pour un compte connecté, présentation
 * du jeu (rendue côté serveur, indexable) pour un visiteur ou tant que la session n'est pas vérifiée.
 */
export function HowToPlayGate({ teaser }: { teaser: ReactNode }) {
  const { user } = useCollection();
  if (!user) return <>{teaser}</>;
  return (
    <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
      <HowToPlayScreen />
    </div>
  );
}
