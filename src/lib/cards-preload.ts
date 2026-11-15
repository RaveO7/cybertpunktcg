import { thumbnailPath } from "@/lib/card-image";
import { alignReleasedFilters, browseChecklist, filterPrintings, parseFilters, sortPrintings } from "@/lib/logic";
import { filterDefaultsFrom, type UserPreferences } from "@/lib/preferences";
import type { CatalogDTO, SortKey } from "@/lib/types";

/** Tris qui dépendent de la collection de l'utilisateur : l'ordre n'est pas connu sans elle. */
const OWNERSHIP_SORTS = new Set<SortKey>(["owned-first", "missing-first", "qty-asc", "qty-desc"]);

/**
 * Largeurs d'écran à partir desquelles la carte d'indice donné est sur la première rangée de la grille
 * (voir layoutFor de VirtualCardGrid : 3 colonnes dès 640 px filtres ouverts, 4 dès 1024 px). Les deux
 * premières le sont partout. Sur téléphone (2 colonnes), précharger les 3e et 4e cartes, en 400 px alors
 * que la grille les affiche plus petites, prenait de la bande passante à l'image LCP pour rien.
 */
export function firstRowMedia(index: number): string | undefined {
  if (index < 2) return undefined;
  return index === 2 ? "(min-width: 640px)" : "(min-width: 1024px)";
}

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
): string[] {
  const defaults = filterDefaultsFrom(view);
  const filters = alignReleasedFilters(parseFilters(params, true, defaults));
  if (filters.collection !== "all" || OWNERSHIP_SORTS.has(filters.sort)) return [];
  const cards = new Map(catalog.cards.map((card) => [card.id, card]));
  const sets = new Map(catalog.sets.map((set) => [set.code, set]));
  const none = new Map();
  const matched = filterPrintings(catalog.printings, cards, none, filters, browseChecklist(catalog.printings, filters.set));
  return sortPrintings(matched, cards, none, sets, filters.sort, { q: filters.q, defaultSort: defaults.sort })
    .slice(0, count)
    .flatMap((printing) => (printing.imagePath ? [thumbnailPath(printing.imagePath) ?? printing.imagePath] : []));
}
