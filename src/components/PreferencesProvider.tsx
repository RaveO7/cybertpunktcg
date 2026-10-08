"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  applyTheme,
  readStoredPreferences,
  writeStoredPreferences,
  type UserPreferences,
} from "@/lib/preferences";

type PreferencesContextValue = {
  prefs: UserPreferences;
  setPrefs: (partial: Partial<UserPreferences>) => void;
  resetPrefs: () => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function subscribePreferences(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

let clientSnapshot: UserPreferences = DEFAULT_PREFERENCES;

function preferencesEqual(a: UserPreferences, b: UserPreferences) {
  return (
    a.theme === b.theme &&
    a.currency === b.currency &&
    a.condition === b.condition &&
    a.sort === b.sort &&
    a.collection === b.collection &&
    a.filtersPanel === b.filtersPanel
  );
}

function getClientPreferences() {
  const next = readStoredPreferences();
  if (preferencesEqual(clientSnapshot, next)) return clientSnapshot;
  clientSnapshot = next;
  return clientSnapshot;
}

function getServerPreferences() {
  return DEFAULT_PREFERENCES;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const stored = useSyncExternalStore(subscribePreferences, getClientPreferences, getServerPreferences);
  const [prefs, setPrefsState] = useState<UserPreferences>(stored);
  // Préférences changées ailleurs (autre onglet, hydratation) : on suit, pendant le rendu plutôt que dans un effet.
  const [syncedStored, setSyncedStored] = useState(stored);
  if (stored !== syncedStored) {
    setSyncedStored(stored);
    setPrefsState(stored);
  }

  useEffect(() => {
    applyTheme(prefs.theme);
  }, [prefs.theme]);

  function setPrefs(partial: Partial<UserPreferences>) {
    // Effets de bord hors de la fonction de mise à jour : React l'exécute pendant le rendu, et
    // l'événement « storage » y réveillerait les autres abonnés en plein rendu.
    // clientSnapshot est la dernière valeur écrite : deux appels rapprochés se cumulent.
    const next = { ...clientSnapshot, ...partial };
    clientSnapshot = next;
    writeStoredPreferences(next);
    if (partial.theme) applyTheme(next.theme);
    setPrefsState(next);
    window.dispatchEvent(new StorageEvent("storage", { key: PREFERENCES_STORAGE_KEY }));
  }

  function resetPrefs() {
    clientSnapshot = DEFAULT_PREFERENCES;
    writeStoredPreferences(DEFAULT_PREFERENCES);
    applyTheme(DEFAULT_PREFERENCES.theme);
    window.dispatchEvent(new StorageEvent("storage", { key: PREFERENCES_STORAGE_KEY }));
    setPrefsState(DEFAULT_PREFERENCES);
  }

  return (
    <PreferencesContext.Provider value={{ prefs, setPrefs, resetPrefs }}>{children}</PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used within PreferencesProvider");
  return value;
}
