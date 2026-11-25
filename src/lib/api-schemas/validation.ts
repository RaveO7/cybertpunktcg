import { NextResponse } from "next/server";
import type { z } from "zod";
import { apiError } from "../api-response";
import { apiMessage as m, decodeApiMessage, type ApiMessageKey, type ApiMessageValues } from "../app-error";

const INVALID_REQUEST = m("common.invalidRequest");

/** Lit les paramètres d'URL (une valeur par clé) puis les valide. */
export function validateSearchParams<S extends z.ZodType>(schema: S, params: URLSearchParams) {
  return validate(schema, Object.fromEntries(params.entries()));
}

export type ValidationFailure = { key: ApiMessageKey; values?: ApiMessageValues; status: number };

type ParseResult<T> = { ok: true; data: T } | { ok: false; failure: ValidationFailure };

/** Valide une valeur ; renvoie sinon le premier message utile (clé du bloc `api`) et le statut. */
export function validate<S extends z.ZodType>(schema: S, value: unknown, status = 400): ParseResult<z.output<S>> {
  // Les messages non personnalisés (types inattendus, champs absents) deviennent « Requête invalide. ».
  const result = schema.safeParse(value, { error: () => INVALID_REQUEST });
  if (result.success) return { ok: true, data: result.data };
  const decoded = decodeApiMessage(result.error.issues[0]?.message ?? "") ?? { key: "common.invalidRequest" };
  return { ok: false, failure: { ...decoded, status } };
}

/** Réponse `{ error }` traduite d'une validation refusée. */
export function validationError(request: Request, failure: ValidationFailure) {
  return apiError(request, failure.key, failure.status, { values: failure.values });
}

/** Lit le corps JSON puis le valide. Un corps absent ou mal formé vaut `null`. */
export async function readJsonBody<S extends z.ZodType>(
  request: Request,
  schema: S,
  status = 400,
): Promise<{ ok: true; data: z.output<S> } | { ok: false; response: NextResponse }> {
  const body: unknown = await request.json().catch(() => null);
  const parsed = validate(schema, body, status);
  return parsed.ok ? parsed : { ok: false, response: await validationError(request, parsed.failure) };
}
