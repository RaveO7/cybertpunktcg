"use client";

import { useTranslations } from "next-intl";
import { AuthScreen } from "@/components/AuthScreen";
import { useCollection } from "@/components/CollectionProvider";

/**
 * Page réservée aux comptes : affichée dès que la session est connue (mémorisée ou vérifiée), l'écran
 * de connexion seulement après un refus du serveur. Chaque écran gère ensuite le chargement de ses données.
 */
export function RequireUser({ children }: { children: React.ReactNode }) {
  const { session, error } = useCollection();
  const t = useTranslations();
  if (session === "signed-out") return <AuthScreen />;
  if (session === "unknown") {
    return (
      <div className="flex flex-1 items-center justify-center text-sm opacity-70" role="status" aria-live="polite">
        {error ?? t("common.loading")}
      </div>
    );
  }
  return <>{children}</>;
}
