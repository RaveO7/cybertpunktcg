"use client";

import { useCallback } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { useI18n } from "@/components/LocaleProvider";
import { landingSectionPath, localizedPath, type PublicRouteKey } from "@/lib/seo/routes";

/** Lien vers une page publique dans la langue de la page courante (français hors pages bilingues). */
export function useLocalizedHref() {
  const { routeLocale } = useI18n();
  const locale = routeLocale ?? "fr";
  return useCallback(
    (key: PublicRouteKey, params?: Record<string, string>, search?: string | URLSearchParams | null) =>
      localizedPath(key, locale, params, search),
    [locale],
  );
}

/**
 * Annuaire des tournois ou des boutiques : page dédiée pour un compte connecté, section de l'accueil
 * pour un visiteur (l'annuaire n'a pas de page publique).
 */
export function useDirectoryHref(section: "tournaments" | "shops") {
  const { user } = useCollection();
  const { routeLocale } = useI18n();
  if (user) return section === "tournaments" ? "/tournois/publics" : "/boutiques";
  return landingSectionPath(section, routeLocale ?? "fr");
}
