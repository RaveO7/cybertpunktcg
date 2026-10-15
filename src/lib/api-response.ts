// Réponses d'erreur des routes API, traduites dans la langue de la page qui appelle.
import { NextResponse } from "next/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/config";
import { splitLocale } from "@/i18n/match";
import { translatorFor } from "@/i18n/server";
import { AppError, type ApiMessageKey, type ApiMessageValues } from "@/lib/app-error";
import { reportError } from "@/lib/monitoring";

function cookieValue(request: Request, name: string) {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

/**
 * Langue d'une requête d'API : celle de la page d'origine (Referer du même site), sinon la langue
 * choisie (cookie), sinon le français.
 */
export function requestLocale(request: Request): Locale {
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      const page = new URL(referer);
      if (page.host === new URL(request.url).host) return splitLocale(page.pathname).locale;
    } catch {
      // Referer illisible : on passe au cookie.
    }
  }
  const chosen = cookieValue(request, LOCALE_COOKIE);
  return isLocale(chosen) ? chosen : DEFAULT_LOCALE;
}

/** Texte d'un message d'erreur dans la langue de la requête. */
export async function apiText(request: Request, key: ApiMessageKey, values?: ApiMessageValues) {
  const t = await translatorFor(requestLocale(request), "api");
  return (t as (key: string, values?: ApiMessageValues) => string)(key, values);
}

type ErrorInit = { values?: ApiMessageValues; details?: unknown; headers?: HeadersInit };

/** Réponse `{ error }` traduite. */
export async function apiError(request: Request, key: ApiMessageKey, status: number, init: ErrorInit = {}) {
  const error = await apiText(request, key, init.values);
  return NextResponse.json(
    { error, ...(init.details !== undefined ? { details: init.details } : {}) },
    { status, headers: init.headers },
  );
}

export function sessionRequired(request: Request) {
  return apiError(request, "common.sessionRequired", 401);
}

/**
 * Refus métier → message traduit et statut. Toute autre erreur → `fallback` (400) s'il est donné,
 * sinon 500 signalée.
 */
export async function errorResponse(request: Request, source: string, error: unknown, fallback?: ApiMessageKey) {
  if (error instanceof AppError) {
    return apiError(request, error.key, error.status, { values: error.values, details: error.details });
  }
  if (fallback) return apiError(request, fallback, 400);
  await reportError(source, error);
  return apiError(request, "common.serverError", 500);
}
