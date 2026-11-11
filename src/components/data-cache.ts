"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { api, type Parsed, type SchemaName } from "@/lib/client/api";

/**
 * Cache mémoire des réponses JSON des écrans (decks, tournois, partage…), pour la durée de l'onglet.
 * Revenir sur un écran affiche aussitôt la dernière réponse connue, puis la met à jour en arrière-plan
 * (« stale-while-revalidate ») : plus d'écran « Chargement… » à chaque changement de page.
 * Vidé à chaque changement de session (cf. CollectionProvider) : jamais de données d'un autre compte.
 * Chaque réponse est vérifiée par son schéma avant d'entrer dans le cache.
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

/** Clé de cache d'une requête : l'URL, suivie du corps (JSON) pour un POST. */
function requestKey(url: string, body?: unknown) {
  return body === undefined ? url : `${url}\n${JSON.stringify(body)}`;
}

export function readCached<T>(url: string, body?: unknown): T | undefined {
  return store.get(requestKey(url, body)) as T | undefined;
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

type CachedRequest<K extends SchemaName> = {
  schema: K;
  /** Paramètres trop longs pour l'URL : lecture en POST, mise en cache par URL et corps. */
  body?: unknown;
};

/**
 * Lecture JSON mise en cache ; les appels simultanés à la même requête partagent le même envoi.
 * Échec : `ApiError` (cf. src/lib/client/api.ts), rien n'est mis en cache.
 */
export function fetchCached<K extends SchemaName>(url: string, { schema, body }: CachedRequest<K>): Promise<Parsed<K>> {
  const key = requestKey(url, body);
  const pending = inflight.get(key);
  if (pending) return pending as Promise<Parsed<K>>;
  const startedAt = generation;
  const editsAtStart = edits.get(key) ?? 0;
  const request = api(url, { schema, body, cache: "no-store" })
    .then((result) => {
      if (startedAt === generation && editsAtStart === (edits.get(key) ?? 0)) putEntry(key, result);
      return result;
    })
    .finally(() => {
      if (inflight.get(key) === request) inflight.delete(key);
    });
  inflight.set(key, request);
  return request;
}

/** Charge en tâche de fond une URL pas encore en cache (préchargement des écrans). */
export function prefetchCached(url: string, schema: SchemaName) {
  // Échec ignoré sans risque : l'écran refait la requête à son ouverture et affiche alors l'erreur.
  if (!store.has(url) && !inflight.has(url)) void fetchCached(url, { schema }).catch(() => undefined);
}

/**
 * Données JSON d'un écran : la copie en cache tout de suite, rafraîchie à chaque montage.
 * `error` n'est vrai que si rien n'a pu être affiché. `url` à null : rien n'est chargé.
 */
export function useCachedJson<K extends SchemaName, T = Parsed<K>>(url: string | null, schema: K) {
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
    fetchCached(url, { schema })
      .then(() => {
        if (!cancelled) setFailedUrl(null);
      })
      .catch(() => {
        if (!cancelled) setFailedUrl(url);
      });
    return () => {
      cancelled = true;
    };
  }, [url, schema, attempt]);

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
