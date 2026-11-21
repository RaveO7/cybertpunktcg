/*
 * Requêtes de démarrage lancées dès le <head> (cf. SiteShell), avant le chargement et l'hydratation de
 * React : quand une session est mémorisée sur l'appareil, collection et catalogue partent aussitôt, en
 * parallèle du JS, et leurs réponses sont lues dès leur arrivée. CollectionProvider reprend ces résultats
 * (déjà prêts le plus souvent : le tableau de bord s'affiche alors dès la fin de l'hydratation) et demande
 * lui-même ce que le script n'a pas lancé.
 */
import type { ResponseSchemas } from "@/lib/client/api";
import { SESSION_HINT_COOKIE } from "@/lib/session-cookie";
import { SESSION_USER_KEY } from "@/lib/session-hint";
import type { CatalogDTO } from "@/lib/types";

const GLOBAL_KEY = "__cptcgBoot";

// Catalogue : redemandé à chaque démarrage, mais revalidé (ETag) pour ne pas retélécharger une version
// déjà en cache. Collection : jamais servie par le cache HTTP.
const CATALOG_INIT: RequestInit = { cache: "no-cache" };
const COLLECTION_INIT: RequestInit = { cache: "no-store" };

/**
 * Liste des decks (« /fr/decks », sans « ?deck= ») : le catalogue (~80 Ko) n'y sert qu'à résumer les decks
 * existants. Lancé au démarrage, il partageait la bande passante du premier affichage : ni ce script ni
 * CollectionProvider (useCatalogGate) ne le demandent avant qu'un écran en ait besoin.
 */
export const DECKS_LIST_PATH = /^\/[a-z]{2}\/decks\/?$/;
const DECK_PARAM = /[?&]deck=/;

/** Réponse de GET /api/collection, lue par `collectionBody` (`body` null si refusée). */
export type CollectionResult = {
  status: number;
  body: unknown;
};

/**
 * Compte de la session et ses lignes, vérifiés ; null si la réponse est refusée ou au format inattendu.
 * `schemas` : cf. loadResponseSchemas (src/lib/client/api.ts).
 */
export function collectionBody(schemas: ResponseSchemas, result: CollectionResult) {
  if (result.body === null) return null;
  const parsed = schemas.collectionSessionSchema.safeParse(result.body);
  if (parsed.success) return parsed.data;
  console.error("Réponse au format inattendu", { url: "/api/collection", error: parsed.error });
  return null;
}

export type BootRequests = {
  collection: Promise<CollectionResult>;
  /** null : réponse en erreur ; absent : non lancé sur cette page (DECKS_LIST_PATH). */
  catalog?: Promise<CatalogDTO | null>;
  /** Résultats déjà arrivés, lisibles sans attendre. */
  done: { collection?: CollectionResult; catalog?: CatalogDTO | null };
};

export function requestCollection(): Promise<CollectionResult> {
  return fetch("/api/collection", COLLECTION_INIT).then(async (response) => ({
    status: response.status,
    body: response.ok ? ((await response.json()) as unknown) : null,
  }));
}

export function requestCatalog(): Promise<CatalogDTO | null> {
  return fetch("/api/catalog", CATALOG_INIT).then((response) =>
    response.ok ? (response.json() as Promise<CatalogDTO>) : null,
  );
}

/** Indicateur de session posé par le proxy (src/proxy.ts), cherché dans document.cookie. */
const SESSION_HINT_PATTERN = `/(?:^|;\\s*)${SESSION_HINT_COOKIE}=/`;

/**
 * Version autonome (sans module) de requestCollection, requestCatalog, exécutée dans le <head>. Lancée si
 * la session est mémorisée sur l'appareil, ou si l'indicateur de session est présent (stockage local vidé
 * ou effacé par le navigateur, mesure Lighthouse).
 */
export const BOOT_REQUESTS_SCRIPT = `(function(){try{if(!localStorage.getItem(${JSON.stringify(SESSION_USER_KEY)})&&!${SESSION_HINT_PATTERN}.test(document.cookie))return;var d={};var b={done:d,collection:fetch("/api/collection",${JSON.stringify(COLLECTION_INIT)}).then(function(r){return(r.ok?r.json():Promise.resolve(null)).then(function(body){return d.collection={status:r.status,body:body}})})};b.collection.catch(function(){});if(!${DECKS_LIST_PATH}.test(location.pathname)||${DECK_PARAM}.test(location.search)){b.catalog=fetch("/api/catalog",${JSON.stringify(CATALOG_INIT)}).then(function(r){return r.ok?r.json():null}).then(function(c){d.catalog=c;return c});b.catalog.catch(function(){})}window[${JSON.stringify(GLOBAL_KEY)}]=b;}catch(e){}})();`;

/** Requêtes lancées par le script de démarrage, reprises une seule fois. */
export function takeBootRequests(): BootRequests | null {
  const scope = window as unknown as Record<string, BootRequests | undefined>;
  const boot = scope[GLOBAL_KEY] ?? null;
  delete scope[GLOBAL_KEY];
  return boot;
}
