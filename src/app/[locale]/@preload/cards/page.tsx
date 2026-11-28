import { cookies } from "next/headers";
import { preload } from "react-dom";
import { firstGridImages } from "@/lib/cards-preload";
import { loadCatalogCached } from "@/lib/catalog";
import { CARDS_VIEW_COOKIE, parseCardsViewCookie } from "@/lib/preferences";

/** Première rangée la plus large de la grille (4 colonnes) ; les 2 premières sont visibles à toutes les largeurs. */
const PRELOADED_CARDS = 4;
const HIGH_PRIORITY_CARDS = 2;

/**
 * Préchargement des images des premières cartes de la collection (image LCP de la page), dans le <head>.
 * Route parallèle et non la page elle-même : RequireUser n'affiche pas les pages privées au rendu serveur
 * (session inconnue), le HTML partirait sans attendre la page et sans ces balises.
 * `preload()` et non des <link> rendus ici : React les place lui-même dans le <head>, alors que l'emplacement
 * est rendu dans le <body> (rendu dans le <head>, il faisait échouer l'hydratation par intermittence).
 */
export default async function CardsPreload({ searchParams }: PageProps<"/[locale]/cards">) {
  const [query, cookieStore, catalog] = await Promise.all([searchParams, cookies(), loadCatalogCached()]);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  }
  const view = parseCardsViewCookie(cookieStore.get(CARDS_VIEW_COOKIE)?.value);
  firstGridImages(catalog, params, view, PRELOADED_CARDS).forEach((href, index) => {
    preload(href, { as: "image", fetchPriority: index < HIGH_PRIORITY_CARDS ? "high" : "auto" });
  });
  return null;
}
