"use client";

import { useCallback } from "react";
import { useI18n } from "@/components/LocaleProvider";
import { localizedPath, type PublicRouteKey } from "@/lib/seo/routes";

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
