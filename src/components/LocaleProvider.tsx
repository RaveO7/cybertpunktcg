"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  isLocale,
  messages,
  type Locale,
  type Messages,
} from "@/lib/i18n/messages";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Messages;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

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

export function LocaleProvider({ children }: { children: ReactNode }) {
  const stored = useSyncExternalStore(subscribeLocale, getClientLocale, getServerLocale);
  const [locale, setLocaleState] = useState<Locale>(stored);
  // Langue changée ailleurs (autre onglet, hydratation) : on suit, pendant le rendu plutôt que dans un effet.
  const [syncedStored, setSyncedStored] = useState(stored);
  if (stored !== syncedStored) {
    setSyncedStored(stored);
    setLocaleState(stored);
  }

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function setLocale(next: Locale) {
    setLocaleState(next);
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: messages[locale] }}>{children}</LocaleContext.Provider>
  );
}

export function useI18n() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useI18n must be used within LocaleProvider");
  return value;
}
