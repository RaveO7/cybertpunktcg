"use client";

import { useLocale } from "next-intl";
import { useEffect, useSyncExternalStore } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { alternatePath } from "@/i18n/paths";
import { isLocaleSwitching, migrateLegacyLocalePreference, readLocalePreference, subscribeLocalePreference } from "@/i18n/preference";

/**
 * Reprise de la langue choisie avec l'ancienne version du site (localStorage) : recopiée une fois dans
 * le cookie de préférence, pour tous les visiteurs (la suggestion de langue en tient compte).
 */
export function LegacyLocalePreference() {
  useEffect(() => {
    migrateLegacyLocalePreference();
  }, []);
  return null;
}

/**
 * Utilisateur connecté sur une page dans une autre langue que celle qu'il a choisie : même page dans
 * sa langue. Le proxy le fait à chaque requête ; ce composant couvre la connexion sur une page déjà
 * ouverte et la reprise de l'ancienne préférence. Les visiteurs et les robots ne sont jamais redirigés.
 */
export function PreferredLanguageRedirect() {
  const { user } = useCollection();
  const locale = useLocale();
  const preference = useSyncExternalStore(subscribeLocalePreference, readLocalePreference, () => null);

  useEffect(() => {
    // Changement de langue en cours (sélecteur) : la navigation est déjà lancée.
    if (!user || !preference || preference === locale || isLocaleSwitching()) return;
    const target = alternatePath(window.location.pathname, window.location.search, preference);
    if (target) window.location.replace(`${target}${window.location.hash}`);
  }, [user, preference, locale]);

  return null;
}
