"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  isLocale,
  messages,
  type Locale,
  type Messages,
} from "@/lib/i18n/messages";
import { alternatePath, routeOfPath, type SiteLocale } from "@/lib/seo/routes";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Messages;
  /** Langue imposée par l'URL d'une page publique bilingue (null : langue enregistrée). */
  routeLocale: SiteLocale | null;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const StoredLocaleOverride = createContext<((active: boolean) => void) | null>(null);

function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isLocale(stored)) return stored;
  } catch {
    // ignore
  }
  return DEFAULT_LOCALE;
}

function subscribeLocale(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getClientLocale() {
  return readStoredLocale();
}

function getServerLocale() {
  return DEFAULT_LOCALE;
}

/**
 * Langue affichée : celle de l'URL sur une page publique bilingue (identique serveur / client),
 * sinon celle enregistrée dans le navigateur.
 */
export function resolveLocale(pathname: string, stored: Locale, useStored: boolean): { locale: Locale; routeLocale: SiteLocale | null } {
  const routeLocale = useStored ? null : routeOfPath(pathname)?.locale ?? null;
  return { locale: routeLocale ?? stored, routeLocale };
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const stored = useSyncExternalStore(subscribeLocale, getClientLocale, getServerLocale);
  const [chosen, setChosen] = useState<Locale>(stored);
  const [storedOverride, setStoredOverride] = useState(false);
  // Langue changée ailleurs (autre onglet, hydratation) : on suit, pendant le rendu plutôt que dans un effet.
  const [syncedStored, setSyncedStored] = useState(stored);
  if (stored !== syncedStored) {
    setSyncedStored(stored);
    setChosen(stored);
  }
  const { locale, routeLocale } = resolveLocale(pathname, chosen, storedOverride);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function setLocale(next: Locale) {
    setChosen(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
    // Page publique bilingue : changer de langue, c'est aller sur l'URL de l'autre version.
    if (routeLocale && (next === "fr" || next === "en") && next !== routeLocale) {
      const target = alternatePath(pathname, window.location.search, next);
      if (target) window.location.assign(target);
    }
  }

  return (
    <StoredLocaleOverride.Provider value={setStoredOverride}>
      <LocaleContext.Provider value={{ locale, setLocale, t: messages[locale], routeLocale }}>{children}</LocaleContext.Provider>
    </StoredLocaleOverride.Provider>
  );
}

/**
 * Rendu dans une page bilingue qui affiche en fait l'application (tableau de bord sur « / ») :
 * la langue enregistrée reprend la main tant que ce composant est monté.
 */
export function UseStoredLocale() {
  const setOverride = useContext(StoredLocaleOverride);
  useEffect(() => {
    setOverride?.(true);
    return () => setOverride?.(false);
  }, [setOverride]);
  return null;
}

export function useI18n() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useI18n must be used within LocaleProvider");
  return value;
}
