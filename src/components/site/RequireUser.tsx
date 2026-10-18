"use client";

import dynamic from "next/dynamic";
import { useCollection } from "@/components/CollectionProvider";
import { AppSplash } from "@/components/site/AppSplash";

// Écran de connexion chargé seulement quand il s'affiche (session refusée) : pas au démarrage d'un compte
// connecté.
const AuthScreen = dynamic(() => import("@/components/AuthScreen").then((module) => module.AuthScreen), {
  loading: () => <AppSplash />,
});

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
