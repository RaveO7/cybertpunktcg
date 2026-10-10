import { Suspense } from "react";
import { DecksScreen } from "@/components/DecksScreen";

export default function DecksPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted">Chargement des decks…</p>}>
      <DecksScreen />
    </Suspense>
  );
}
