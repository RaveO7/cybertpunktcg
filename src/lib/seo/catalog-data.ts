import { cache } from "react";
import { unstable_cache } from "next/cache";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { CATALOG_CACHE_TAG, loadCatalogCached } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { loadCardTranslations } from "@/i18n/cards";
import type { Locale } from "@/i18n/config";
import { publicCards, type PublicCard } from "@/lib/seo/public-catalog";

/**
 * Cartes du catalogue public dans une langue (lecture du catalogue en cache, invalidé à l'import des
 * prix), avec les traductions du texte de règles du site pour cette langue. `cache` : calculé une fois
 * par rendu, partagé entre generateMetadata et la page.
 */
export const loadPublicCards = cache((locale: Locale) => {
  if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) return computePublicCards(locale);
  let cards = buildMemo.get(locale);
  if (!cards) {
    cards = computePublicCards(locale);
    buildMemo.set(locale, cards);
  }
  return cards;
});

/**
 * Pendant le build seulement : cartes calculées une fois par langue et par processus. Sans elle, chacune
 * des ~800 pages prérendues relisait et retriait le catalogue entier (5,6 s sur 59 s de génération
 * statique avec un seul worker, comme sur Vercel). En service, le catalogue change à l'import des prix :
 * pas de mémoire entre deux rendus.
 */
const buildMemo = new Map<Locale, Promise<PublicCard[]>>();

async function computePublicCards(locale: Locale) {
  const [catalog, translations] = await Promise.all([loadCatalogCached(), loadCardTranslations(locale)]);
  return publicCards(catalog, locale, translations);
}

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
