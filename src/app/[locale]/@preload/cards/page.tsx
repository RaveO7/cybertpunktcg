import { cookies } from "next/headers";
import { firstGridImages } from "@/lib/cards-preload";
import { FIRST_ROW_IMAGE_SIZES } from "@/lib/card-image";
import { loadCatalogCached } from "@/lib/catalog";
import { CARDS_VIEW_COOKIE, parseCardsViewCookie } from "@/lib/preferences";

/**
 * Les 2 premières cartes, visibles à toutes les largeurs, en priorité normale : sur mobile (4G lente),
 * précharger toute la rangée en priorité haute retardait le JavaScript qui affiche la grille.
 */
const PRELOADED_CARDS = 2;

/**
 * Préchargement des images des premières cartes de la collection (image LCP de la page), dans le <head>.
 * Route parallèle et non la page elle-même : RequireUser n'affiche pas les pages privées au rendu serveur
 * (session inconnue), le HTML partirait sans attendre la page et sans ces balises.
 */
export default async function CardsPreload({ searchParams }: PageProps<"/[locale]/cards">) {
  const [query, cookieStore, catalog] = await Promise.all([searchParams, cookies(), loadCatalogCached()]);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  }
  const view = parseCardsViewCookie(cookieStore.get(CARDS_VIEW_COOKIE)?.value);
  return firstGridImages(catalog, params, view, PRELOADED_CARDS).map(({ href, srcSet }) => (
    <link
      key={href}
      rel="preload"
      as="image"
      href={href}
      imageSrcSet={srcSet}
      imageSizes={srcSet ? FIRST_ROW_IMAGE_SIZES : undefined}
    />
  ));
}
