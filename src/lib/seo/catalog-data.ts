import { cache } from "react";
import { unstable_cache } from "next/cache";
import { CATALOG_CACHE_TAG, loadCatalogCached } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { loadCardTranslations } from "@/i18n/cards";
import type { Locale } from "@/i18n/config";
import { publicCards } from "@/lib/seo/public-catalog";

/**
 * Cartes du catalogue public dans une langue (lecture du catalogue en cache, invalidé à l'import des
 * prix), avec les traductions du texte de règles du site pour cette langue. `cache` : calculé une fois
 * par rendu, partagé entre generateMetadata et la page.
 */
export const loadPublicCards = cache(async (locale: Locale) => {
  const [catalog, translations] = await Promise.all([loadCatalogCached(), loadCardTranslations(locale)]);
  return publicCards(catalog, locale, translations);
});

/** Date du dernier import des prix Cardmarket (ISO), ou null. */
export const latestPriceDate = unstable_cache(
  async () => {
    const result = await prisma.price.aggregate({
      where: { kind: "trend", source: { code: "cardmarket" } },
      _max: { updatedAt: true },
    });
    return result._max.updatedAt?.toISOString() ?? null;
  },
  ["public-price-date"],
  { tags: [CATALOG_CACHE_TAG], revalidate: 3600 },
);
