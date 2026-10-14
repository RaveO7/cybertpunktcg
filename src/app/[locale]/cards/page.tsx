import { Suspense } from "react";
import { CardsExplorer } from "@/components/CardsExplorer";
import { privateMetadata } from "@/lib/seo/metadata";

// Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée.
export const metadata = privateMetadata;

export default function CardsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted">Chargement des cartes…</p>}>
      <CardsExplorer />
    </Suspense>
  );
}
