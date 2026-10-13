import { unstable_cache } from "next/cache";
import { CATALOG_CACHE_TAG, loadCatalogCached } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { publicCards } from "@/lib/seo/public-catalog";
import type { SiteLocale } from "@/lib/seo/routes";

/** Cartes du catalogue public dans une langue (lecture du catalogue en cache, invalidé à l'import des prix). */
export async function loadPublicCards(locale: SiteLocale) {
  return publicCards(await loadCatalogCached(), locale);
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
