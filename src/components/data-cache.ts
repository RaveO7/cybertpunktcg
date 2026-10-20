"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/**
 * Cache mémoire des réponses JSON des écrans (decks, tournois, partage…), pour la durée de l'onglet.
 * Revenir sur un écran affiche aussitôt la dernière réponse connue, puis la met à jour en arrière-plan
 * (« stale-while-revalidate ») : plus d'écran « Chargement… » à chaque changement de page.
 * Vidé à chaque changement de session (cf. CollectionProvider) : jamais de données d'un autre compte.
 */
const store = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Set<() => void>();
// Modifications locales par URL : une réponse partie avant une modification ne l'écrase pas.
const edits = new Map<string, number>();
// Incrémenté à chaque vidage : une réponse partie avant ne doit pas réécrire le cache.
let generation = 0;

function notify() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function readCached<T>(url: string): T | undefined {
  return store.get(url) as T | undefined;
}

function putEntry(url: string, value: unknown) {
  store.set(url, value);
  notify();
}

/** Modification locale (après une action de l'utilisateur) : prime sur les réponses en cours. */
export function writeCached<T>(url: string, value: T) {
  edits.set(url, (edits.get(url) ?? 0) + 1);
  putEntry(url, value);
}

export function clearDataCache() {
  generation++;
  store.clear();
  inflight.clear();
  edits.clear();
  notify();
}

/** GET JSON mis en cache ; les appels simultanés à la même URL partagent la même requête. */
export function fetchCached<T>(url: string): Promise<T> {
  const pending = inflight.get(url);
  if (pending) return pending as Promise<T>;
  const startedAt = generation;
  const editsAtStart = edits.get(url) ?? 0;
  const request = fetch(url, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as T;
      if (startedAt === generation && editsAtStart === (edits.get(url) ?? 0)) putEntry(url, body);
      return body;
    })
    .finally(() => {
      if (inflight.get(url) === request) inflight.delete(url);
    });
  inflight.set(url, request);
  return request;
}

/** Charge en tâche de fond une URL pas encore en cache (préchargement des écrans). */
export function prefetchCached(url: string) {
  if (!store.has(url) && !inflight.has(url)) void fetchCached(url).catch(() => undefined);
}

/**
 * Données JSON d'un écran : la copie en cache tout de suite, rafraîchie à chaque montage.
 * `error` n'est vrai que si rien n'a pu être affiché. `url` à null : rien n'est chargé.
 */
export function useCachedJson<T>(url: string | null) {
  const data = useSyncExternalStore(
    subscribe,
    () => (url ? readCached<T>(url) : undefined),
    () => undefined,
  );
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  // Incrémenté par `retry` : relance la requête après un échec.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetchCached<T>(url)
      .then(() => {
        if (!cancelled) setFailedUrl(null);
      })
      .catch(() => {
        if (!cancelled) setFailedUrl(url);
      });
    return () => {
      cancelled = true;
    };
  }, [url, attempt]);

  const retry = useCallback(() => {
    setFailedUrl(null);
    setAttempt((current) => current + 1);
  }, []);

  const mutate = useCallback(
    (update: (current: T | undefined) => T) => {
      if (url) writeCached(url, update(readCached<T>(url)));
    },
    [url],
  );

  return { data, error: data === undefined && failedUrl !== null && failedUrl === url, mutate, retry };
}
