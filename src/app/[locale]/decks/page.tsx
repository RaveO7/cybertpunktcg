import { Suspense } from "react";
import { DecksScreen, DecksSkeleton } from "@/components/DecksScreen";
import { privateMetadata } from "@/lib/seo/metadata";

// Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée.
export const metadata = privateMetadata;

export default function DecksPage() {
  return (
    <Suspense fallback={<DecksSkeleton />}>
      <DecksScreen />
    </Suspense>
  );
}
