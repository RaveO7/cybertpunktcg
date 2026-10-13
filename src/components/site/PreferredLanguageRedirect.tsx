"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useCollection } from "@/components/CollectionProvider";
import { useI18n } from "@/components/LocaleProvider";
import { LOCALE_STORAGE_KEY } from "@/lib/i18n/messages";
import { alternatePath } from "@/lib/seo/routes";

/**
 * Utilisateur connecté sur une page publique bilingue dans l'autre langue que celle choisie dans
 * ses paramètres (français ou anglais) : on l'emmène sur la version de sa langue. Les visiteurs et
 * les robots ne sont jamais redirigés.
 */
export function PreferredLanguageRedirect() {
  const { user } = useCollection();
  const { routeLocale } = useI18n();
  const pathname = usePathname();

  useEffect(() => {
    if (!user || !routeLocale) return;
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    } catch {
      return;
    }
    if ((stored !== "fr" && stored !== "en") || stored === routeLocale) return;
    const target = alternatePath(pathname, window.location.search, stored);
    if (target) window.location.replace(target);
  }, [user, routeLocale, pathname]);

  return null;
}
