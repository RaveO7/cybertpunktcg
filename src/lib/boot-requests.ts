/*
 * Requêtes de démarrage lancées dès le <head> (cf. SiteShell), avant le chargement et l'hydratation de
 * React : quand une session est mémorisée sur l'appareil, collection et catalogue partent aussitôt, en
 * parallèle du JS, et leurs réponses sont lues dès leur arrivée. CollectionProvider reprend ces résultats
 * (déjà prêts le plus souvent : le tableau de bord s'affiche alors dès la fin de l'hydratation).
 */
import { SESSION_USER_KEY } from "@/lib/session-hint";
import type { AuthUser, CatalogDTO, CollectionItemDTO } from "@/lib/types";

const GLOBAL_KEY = "__cptcgBoot";

// Catalogue : redemandé à chaque démarrage, mais revalidé (ETag) pour ne pas retélécharger une version
// déjà en cache. Collection : jamais servie par le cache HTTP.
const CATALOG_INIT: RequestInit = { cache: "no-cache" };
const COLLECTION_INIT: RequestInit = { cache: "no-store" };

/** Réponse de GET /api/collection : le compte de la session avec ses lignes (`body` null si refusée). */
export type CollectionResult = {
  status: number;
  body: { user?: AuthUser; items?: CollectionItemDTO[] } | null;
};

export type BootRequests = {
  collection: Promise<CollectionResult>;
  /** null : réponse en erreur. */
  catalog: Promise<CatalogDTO | null>;
  /** Résultats déjà arrivés, lisibles sans attendre. */
  done: { collection?: CollectionResult; catalog?: CatalogDTO | null };
};

export function requestCollection(): Promise<CollectionResult> {
  return fetch("/api/collection", COLLECTION_INIT).then(async (response) => ({
    status: response.status,
    body: response.ok ? ((await response.json()) as CollectionResult["body"]) : null,
  }));
}

export function requestCatalog(): Promise<CatalogDTO | null> {
  return fetch("/api/catalog", CATALOG_INIT).then((response) =>
    response.ok ? (response.json() as Promise<CatalogDTO>) : null,
  );
}

/** Version autonome (sans module) de requestCollection et requestCatalog, exécutée dans le <head>. */
export const BOOT_REQUESTS_SCRIPT = `(function(){try{if(!localStorage.getItem(${JSON.stringify(SESSION_USER_KEY)}))return;var d={};var b={done:d,collection:fetch("/api/collection",${JSON.stringify(COLLECTION_INIT)}).then(function(r){return(r.ok?r.json():Promise.resolve(null)).then(function(body){return d.collection={status:r.status,body:body}})}),catalog:fetch("/api/catalog",${JSON.stringify(CATALOG_INIT)}).then(function(r){return r.ok?r.json():null}).then(function(c){d.catalog=c;return c})};b.collection.catch(function(){});b.catalog.catch(function(){});window[${JSON.stringify(GLOBAL_KEY)}]=b;}catch(e){}})();`;

/** Requêtes lancées par le script de démarrage, reprises une seule fois. */
export function takeBootRequests(): BootRequests | null {
  const scope = window as unknown as Record<string, BootRequests | undefined>;
  const boot = scope[GLOBAL_KEY] ?? null;
  delete scope[GLOBAL_KEY];
  return boot;
}
