// Refus métier (tournoi, boutique, collection…) : clé de message du bloc `api`, statut HTTP et détails.
// Le texte est traduit dans la langue de la requête au moment de répondre (cf. api-response.ts).
import type { Messages } from "@/i18n/load";

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Clé d'un message d'erreur d'API (« tournaments.notFound »). */
export type ApiMessageKey = Leaves<Messages["api"]>;

export type ApiMessageValues = Record<string, string | number>;

export class AppError extends Error {
  constructor(
    readonly key: ApiMessageKey,
    readonly status: number = 400,
    readonly details?: unknown,
    readonly values?: ApiMessageValues,
  ) {
    super(key);
    this.name = "AppError";
  }
}

export function fail(key: ApiMessageKey, status = 400, details?: unknown, values?: ApiMessageValues): never {
  throw new AppError(key, status, details, values);
}

const SEPARATOR = "|";

/**
 * Message d'un schéma Zod : la clé, suivie de ses valeurs encodées (« shops.nameTooLong|{"max":"80"} »).
 * Les nombres sont passés en texte : « 2000 » reste écrit tel quel dans toutes les langues.
 */
export function apiMessage(key: ApiMessageKey, values?: Record<string, string | number>) {
  if (!values) return key;
  const encoded = Object.fromEntries(Object.entries(values).map(([name, value]) => [name, String(value)]));
  return `${key}${SEPARATOR}${JSON.stringify(encoded)}`;
}

/** Inverse d'`apiMessage`. Un texte qui n'en vient pas donne `null`. */
export function decodeApiMessage(message: string): { key: ApiMessageKey; values?: ApiMessageValues } | null {
  const at = message.indexOf(SEPARATOR);
  const key = (at === -1 ? message : message.slice(0, at)) as ApiMessageKey;
  if (!/^[a-z]+\.[A-Za-z]+$/.test(key)) return null;
  if (at === -1) return { key };
  try {
    return { key, values: JSON.parse(message.slice(at + 1)) as ApiMessageValues };
  } catch {
    return { key };
  }
}
