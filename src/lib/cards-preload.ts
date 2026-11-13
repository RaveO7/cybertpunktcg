import { thumbnailPath, thumbnailSrcSet } from "@/lib/card-image";
import { alignReleasedFilters, browseChecklist, filterPrintings, parseFilters, sortPrintings } from "@/lib/logic";
import { filterDefaultsFrom, type UserPreferences } from "@/lib/preferences";
import type { CatalogDTO, SortKey } from "@/lib/types";

/** Tris qui dépendent de la collection de l'utilisateur : l'ordre n'est pas connu sans elle. */
const OWNERSHIP_SORTS = new Set<SortKey>(["owned-first", "missing-first", "qty-asc", "qty-desc"]);

/** Image à précharger : la miniature et, si elle existe, le même srcset que la tuile de la grille. */
export type GridImage = { href: string; srcSet: string | undefined };

/**
 * Images des premières cartes de la grille de la collection, dans l'ordre où l'écran les affichera
 * (mêmes filtres et même tri que CardsExplorer), pour les précharger dès le HTML : la grille n'est
 * construite qu'une fois le catalogue reçu par le navigateur. Vide quand l'ordre dépend de la
 * collection (filtre possédées/manquantes, tri par possession ou quantité) : mieux vaut ne rien
 * précharger que de précharger les mauvaises images.
 */
export function firstGridImages(
  catalog: CatalogDTO,
  params: URLSearchParams,
  view: Pick<UserPreferences, "sort" | "collection">,
  count: number,
): GridImage[] {
  const defaults = filterDefaultsFrom(view);
  const filters = alignReleasedFilters(parseFilters(params, true, defaults));
  if (filters.collection !== "all" || OWNERSHIP_SORTS.has(filters.sort)) return [];
  const cards = new Map(catalog.cards.map((card) => [card.id, card]));
  const sets = new Map(catalog.sets.map((set) => [set.code, set]));
  const none = new Map();
  const matched = filterPrintings(catalog.printings, cards, none, filters, browseChecklist(catalog.printings, filters.set));
  return sortPrintings(matched, cards, none, sets, filters.sort, { q: filters.q, defaultSort: defaults.sort })
    .slice(0, count)
    .flatMap(({ imagePath }) =>
      imagePath ? [{ href: thumbnailPath(imagePath) ?? imagePath, srcSet: thumbnailSrcSet(imagePath) }] : [],
    );
}
