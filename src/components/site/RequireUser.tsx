"use client";

import { AuthScreen } from "@/components/AuthScreen";
import { useCollection } from "@/components/CollectionProvider";
import { AppSplash } from "@/components/site/AppSplash";

/**
 * Page réservée aux comptes : affichée dès que la session est connue (mémorisée ou vérifiée), l'écran
 * de connexion seulement après un refus du serveur, l'écran de démarrage tant qu'elle est inconnue. Chaque
 * écran gère ensuite le chargement de ses données.
 */
export function RequireUser({ children }: { children: React.ReactNode }) {
  const { session, error } = useCollection();
  if (session === "signed-out") return <AuthScreen />;
  if (session === "unknown") {
    if (!error) return <AppSplash />;
    return (
      <div className="flex flex-1 items-center justify-center text-sm opacity-70" role="alert">
        {error}
      </div>
    );
  }
  return <>{children}</>;
}
