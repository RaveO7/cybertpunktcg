import { Suspense } from "react";
import { DecksScreen } from "@/components/DecksScreen";
import { privateMetadata } from "@/lib/seo/metadata";

// Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée.
export const metadata = privateMetadata;

export default function DecksPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted">Chargement des decks…</p>}>
      <DecksScreen />
    </Suspense>
  );
}
