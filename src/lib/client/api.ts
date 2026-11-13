// Appels du navigateur vers /api : un seul chemin pour l'absence de réseau, la session expirée, les erreurs
// du serveur (message déjà traduit dans la langue de la requête) et les réponses au format inattendu.
// Le message affiché est choisi par l'écran (useApiErrorMessage) à partir de `kind`.

export type ApiErrorKind = "offline" | "session" | "server" | "invalid";

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    /** Code HTTP ; 0 = la requête n'a pas pu partir (pas de réseau). */
    readonly status: number,
    /** Message du serveur (déjà traduit), vide s'il n'en a pas donné. */
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Schéma de réponse : tout objet qui valide une valeur (schémas zod et zod/mini). */
export type ResponseSchema<T> = { parse(value: unknown): T };

export type ResponseSchemas = typeof import("@/lib/api-responses");

/** Nom d'un schéma de src/lib/api-responses.ts : `api(url, { schema: "decksSchema" })`. */
export type SchemaName = { [K in keyof ResponseSchemas]: ResponseSchemas[K] extends ResponseSchema<unknown> ? K : never }[keyof ResponseSchemas];

/** Réponse vérifiée par le schéma `K`. */
export type Parsed<K extends SchemaName> = ResponseSchemas[K] extends ResponseSchema<infer T> ? T : never;

let schemasModule: Promise<ResponseSchemas> | null = null;
let loadedSchemas: ResponseSchemas | null = null;

/**
 * Schémas des réponses, avec le moteur Zod : chargés à part (le moteur pèse autant qu'un écran entier),
 * jamais dans le premier chargement des pages. Un échec (réseau coupé avant leur arrivée) permet un nouvel essai.
 */
export function loadResponseSchemas(): Promise<ResponseSchemas> {
  schemasModule ??= import("@/lib/api-responses").then(
    (schemas) => (loadedSchemas = schemas),
    (error: unknown) => {
      schemasModule = null;
      throw error;
    },
  );
  return schemasModule;
}

/** Schémas déjà chargés, sinon null (affichage immédiat au démarrage, sans attendre leur chargement). */
export function responseSchemasIfLoaded() {
  return loadedSchemas;
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type BaseOptions = {
  method?: Method;
  /** Objet envoyé en JSON, ou fichier envoyé tel quel (son type devient le `content-type`). */
  body?: unknown;
  signal?: AbortSignal;
  cache?: RequestCache;
  /** La requête survit à la fermeture de la page (dernière modification envoyée en partant). */
  keepalive?: boolean;
};

export type ApiOptions<K extends SchemaName> = BaseOptions & { schema: K };

/**
 * Requête vers /api. Avec `schema` (nom d'un schéma de src/lib/api-responses.ts), la réponse est vérifiée
 * et typée ; sans schéma, elle est rendue en `unknown` (réponse ignorée ou lue par un code qui la vérifie
 * lui-même). Une annulation (`signal`) est relancée telle quelle : ce n'est pas une erreur à afficher.
 */
export async function api<K extends SchemaName>(url: string, options: ApiOptions<K>): Promise<Parsed<K>>;
export async function api(url: string, options?: BaseOptions): Promise<unknown>;
export async function api(url: string, options: BaseOptions & { schema?: SchemaName } = {}) {
  const { body, schema, signal, cache, keepalive } = options;
  const method = options.method ?? (body === undefined ? "GET" : "POST");
  // Schémas chargés pendant que la requête part : pas d'attente en plus.
  const schemas = schema ? loadResponseSchemas() : null;
  // Rejet traité plus bas (après la réponse) : sans ce gestionnaire, il serait signalé comme non géré entre-temps.
  schemas?.catch(() => undefined);
  let response: Response;
  try {
    response = await fetch(url, { method, signal, cache, keepalive, ...encodeBody(body) });
  } catch (error) {
    if (isAbort(error)) throw error;
    throw new ApiError("offline", 0, "");
  }
  const payload: unknown = await response.json().catch(() => null);
  if (response.status === 401) throw new ApiError("session", 401, serverMessage(payload));
  if (!response.ok) throw new ApiError("server", response.status, serverMessage(payload), serverDetails(payload));
  if (!schema || !schemas) return payload;
  let loaded: ResponseSchemas;
  try {
    loaded = await schemas;
  } catch {
    // Réseau coupé avant l'arrivée des schémas : la requête a bien atteint le serveur, donc pas « offline »
    // (une écriture serait remise en file et envoyée deux fois). Réponse invérifiable = format inattendu.
    throw new ApiError("invalid", response.status, "");
  }
  try {
    return loaded[schema].parse(payload);
  } catch (error) {
    // Interface en cache plus ancienne (ou plus récente) que le serveur : on le signale sans les données.
    console.error("Réponse au format inattendu", { url, method, error });
    throw new ApiError("invalid", response.status, "");
  }
}

function encodeBody(body: unknown): Pick<RequestInit, "body" | "headers"> {
  if (body === undefined) return {};
  if (body instanceof Blob) return { body, headers: { "content-type": body.type || "application/octet-stream" } };
  return { body: JSON.stringify(body), headers: { "content-type": "application/json" } };
}

export type ApiErrorMessages = { offline: string; session: string; invalid: string };

/** Message à afficher pour un échec : celui du serveur s'il en a donné un, sinon `fallback`. */
export function apiErrorMessage(error: unknown, fallback: string, messages: ApiErrorMessages) {
  if (!(error instanceof ApiError)) return fallback;
  switch (error.kind) {
    case "offline":
      return messages.offline;
    case "session":
      return messages.session;
    case "invalid":
      return messages.invalid;
    case "server":
      return error.message || fallback;
  }
}

export function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function field(payload: unknown, key: string): unknown {
  return payload !== null && typeof payload === "object" ? (payload as Record<string, unknown>)[key] : undefined;
}

function serverMessage(payload: unknown) {
  const message = field(payload, "error");
  return typeof message === "string" ? message : "";
}

function serverDetails(payload: unknown) {
  return field(payload, "details");
}
