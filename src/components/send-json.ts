"use client";

import { useTranslations } from "next-intl";

/** Messages des échecs de requête, dans la langue de la page. */
export function useRequestErrors() {
  return useTranslations("errors.request");
}

export type RequestErrors = ReturnType<typeof useRequestErrors>;

/** fetch d'une modification : sans réseau, un message explicite plutôt qu'un « Failed to fetch ». */
export async function mutationFetch(url: string, init: RequestInit, errors: RequestErrors) {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (!navigator.onLine) throw new Error(errors("offline"));
    throw error;
  }
}

/** Requête JSON d'une modification : le message d'erreur du serveur (déjà traduit) ou un message générique. */
export async function sendJson<T>(url: string, init: RequestInit, errors: RequestErrors): Promise<T> {
  const response = await mutationFetch(
    url,
    { ...init, headers: { "content-type": "application/json", ...(init.headers ?? {}) } },
    errors,
  );
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (response.status === 401) throw new Error(errors("sessionExpired"));
  if (!response.ok) throw new Error(body.error || errors("saveFailed"));
  return body;
}
