import { Suspense } from "react";
import { InvestmentScreen } from "@/components/InvestmentScreen";

export default function InvestmentPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted">Chargement…</p>}>
      <InvestmentScreen />
    </Suspense>
  );
}
