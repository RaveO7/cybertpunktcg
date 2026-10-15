import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { getMessageFallback, onIntlError, TIME_ZONE } from "@/i18n/errors";
import { loadMessages } from "@/i18n/load";
import { routing } from "@/i18n/routing";

/**
 * Configuration de next-intl pour chaque requête : langue du segment [locale] (ou celle passée
 * explicitement, par ex. getTranslations({ locale }) dans une image de partage), messages avec repli.
 */
export default getRequestConfig(async ({ locale: explicit }) => {
  let requested: string | undefined = explicit;
  if (!requested) {
    try {
      requested = await rootLocale();
    } catch {
      // Hors de l'arborescence [locale] (gestionnaire de route, 404 globale) : langue par défaut.
    }
  }
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: TIME_ZONE,
    onError: onIntlError,
    getMessageFallback,
  };
});
