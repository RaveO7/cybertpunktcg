import { createFormatter, createTranslator } from "next-intl";
import type { Locale } from "@/i18n/config";
import { getMessageFallback, onIntlError, TIME_ZONE } from "@/i18n/errors";
import { loadMessages, type Messages } from "@/i18n/load";

type Namespace = keyof Messages;

/**
 * Traducteur d'une langue donnée, hors rendu React : métadonnées, images de partage, données
 * structurées (et leurs tests). Les composants serveur utilisent `getTranslations` de next-intl.
 */
export async function translatorFor<N extends Namespace>(locale: Locale, namespace: N) {
  const messages = await loadMessages(locale);
  return createTranslator({ locale, messages, namespace, onError: onIntlError, getMessageFallback });
}

/** Formateur (dates, prix, nombres) d'une langue donnée, hors rendu React. */
export function formatterFor(locale: Locale) {
  return createFormatter({ locale, timeZone: TIME_ZONE });
}
