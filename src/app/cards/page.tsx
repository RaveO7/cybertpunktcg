import { Suspense } from "react";
import { CardsExplorer } from "@/components/CardsExplorer";

export default function CardsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted">Chargement des cartes…</p>}>
      <CardsExplorer />
    </Suspense>
  );
}
