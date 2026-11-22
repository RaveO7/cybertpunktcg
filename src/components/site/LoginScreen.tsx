"use client";

import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { useCollection } from "@/components/CollectionProvider";
import { getPathname } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/safe-next";

// Paramètres lus dans l'URL du navigateur, pas avec useSearchParams : celui-ci retirerait le formulaire du HTML
// de cette page statique (rendu reporté au navigateur), et Lighthouse mobile compterait tout le JS dans son
// LCP. Au rendu serveur et à l'hydratation, URL sans paramètre : le formulaire du HTML est gardé tel quel.
const noSubscription = () => () => {};
const currentSearch = () => window.location.search;
const serverSearch = () => "";

/**
 * Connexion / inscription depuis les pages publiques, puis retour à `next` (URL complète, dans sa
 * langue), sinon à l'accueil de la langue de l'écran de connexion.
 */
export function LoginScreen() {
  const params = new URLSearchParams(useSyncExternalStore(noSubscription, currentSearch, serverSearch));
  const router = useRouter();
  const { user } = useCollection();
  const mode = params.get("mode");
  const locale = useLocale();
  const next = safeNextPath(params.get("next"), getPathname({ href: "/", locale }));
  const initialMode = mode === "register" || mode === "login" ? mode : null;

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  if (user) return null;
  // Lien vers l'inscription (?mode=register) : l'onglet change juste après l'hydratation.
  return <AuthScreen key={initialMode ?? "default"} initialMode={initialMode} redirectTo={null} />;
}
