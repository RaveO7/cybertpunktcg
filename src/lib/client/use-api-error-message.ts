import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { apiErrorMessage, isAbort, type ApiErrorMessages } from "./api";

/**
 * Message traduit d'un échec d'appel à /api (`fallback` : échec générique de l'action, « Enregistrement
 * impossible » par défaut). Un écran peut remplacer un message par le sien (ex. hors-ligne des tournois).
 * Fonction stable (dépendance d'effet ou de mémo) tant que la langue et les messages ne changent pas.
 */
export function useApiErrorMessage({ offline, session, invalid }: Partial<ApiErrorMessages> = {}) {
  const t = useTranslations("errors.request");
  return useCallback(
    (error: unknown, fallback: string = t("saveFailed")) =>
      apiErrorMessage(error, fallback, {
        offline: offline ?? t("offline"),
        session: session ?? t("sessionExpired"),
        invalid: invalid ?? t("unexpected"),
      }),
    [t, offline, session, invalid],
  );
}

/**
 * Pour les fournisseurs de données dont les écrans affichent `error.message` : l'échec d'un appel devient
 * une `Error` au message traduit. Une annulation est relancée telle quelle.
 */
export function useTranslatedRequest() {
  const message = useApiErrorMessage();
  return useCallback(
    <T>(request: Promise<T>, fallback?: string) =>
      request.catch((error: unknown) => {
        if (isAbort(error)) throw error;
        throw new Error(message(error, fallback));
      }),
    [message],
  );
}
