import { IntlErrorCode, type IntlError } from "next-intl";

/** Fuseau des dates formatées côté serveur (pages publiques). */
export const TIME_ZONE = "Europe/Paris";

/**
 * Texte introuvable même en français : signalé en développement, et la clé s'affiche à la place.
 * Les autres erreurs (message ICU invalide, variable manquante) sont toujours journalisées.
 */
export function onIntlError(error: IntlError) {
  if (error.code === IntlErrorCode.MISSING_MESSAGE) {
    if (process.env.NODE_ENV !== "production") console.warn(`[i18n] ${error.message}`);
    return;
  }
  console.error(error);
}

export function getMessageFallback({ namespace, key }: { namespace?: string; key: string }) {
  return [namespace, key].filter(Boolean).join(".");
}
