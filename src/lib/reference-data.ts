export const MAIN_SET_CODE = "welcometonightcityretail";
export const BETA_SET_CODE = "welcometonightcitybeta";
export const FRENCH_SOURCE_SET_CODE = "welcometonightcityretail-fr";
export const RELEASED_SET_ID = "wtmc";
export const RELEASED_SET_NAME = "Welcome to Night City";
export const ENGLISH_SET_ID = "wtmc-en";
export const FRENCH_SET_ID = "wtmc-fr";
export const BOTH_LANGUAGES_SET_ID = "wtmc-both";
export const ALL_SETS_ID = "all";
export const ENGLISH_SET_NAME = "Welcome to Night City — Anglais";
export const FRENCH_SET_NAME = "Welcome to Night City — Français";

/**
 * Nombre minimal de cartes pour qu'un set soit une vraie extension (set de boosters).
 * Les promos, decks de démo, starter decks et sets de tournoi restent en dessous.
 */
export const MIN_EXTENSION_CARDS = 100;

/**
 * Les sorties se font par bloc : chaque bloc (ex. « Welcome to Night City ») regroupe plusieurs
 * extensions (ici Beta puis Retail). Blocs et extensions sont listés dans l'ordre de sortie.
 * Une extension = code de son set anglais (sa version « -fr » suit d'elle-même).
 * La source officielle ne donne pas le bloc : à compléter à chaque nouvelle extension.
 * Une extension absente de cette liste s'affiche dans « Extensions non classées ».
 *
 * `related` : produits du bloc qui ne sont pas des extensions (starter decks, decks de démo,
 * promos, box toppers, sets de tournoi). Ils servent au filtre par extension des decks : certaines
 * cartes n'existent que là. Un set absent des deux listes range ses cartes dans « Autres ».
 */
export const BLOCKS: readonly { name: string; sets: readonly string[]; related?: readonly string[] }[] = [
  {
    name: RELEASED_SET_NAME,
    sets: [BETA_SET_CODE, MAIN_SET_CODE],
    related: [
      "arasakademodeck",
      "mercdemodeck",
      "embracingpowerbetastarterdeck",
      "embracingpowerretailstarterdeck",
      "theheistbetastarterdeck",
      "theheistretailstarterdeck",
      "prereleasebeta",
      "prereleaseretail",
      "boxtoppersbeta",
      "boxtoppersretail",
      "edgerunneropens1",
      "nightcitybrawls1",
      "nightcityshowdowns1",
      "PRM01",
    ],
  },
];

/** Codes des produits scellés / lots Cardmarket (pas des extensions de cartes). */
export const SEALED_SET_PREFIX = "sealed-";

export function isSealedSetCode(code: string) {
  return code.startsWith(SEALED_SET_PREFIX);
}

/** Filtres « groupe » de l'écran investissement : toutes les cartes ou tout le scellé. */
export const CARDS_GROUP_FILTER = "group:cards";
export const SEALED_GROUP_FILTER = "group:sealed";

export function matchesSetFilter(setCode: string, filter: string | undefined) {
  if (!filter || filter === ALL_SETS_ID) return true;
  if (filter === CARDS_GROUP_FILTER) return !isSealedSetCode(setCode);
  if (filter === SEALED_GROUP_FILTER) return isSealedSetCode(setCode);
  return setCode === filter;
}

export function partitionCatalogSets<T extends { code: string; sortOrder: number }>(sets: T[]) {
  const cardSets: T[] = [];
  const sealedSets: T[] = [];
  for (const set of sets) {
    if (isSealedSetCode(set.code)) sealedSets.push(set);
    else cardSets.push(set);
  }
  sealedSets.sort((a, b) => a.sortOrder - b.sortOrder);
  return { cardSets, sealedSets };
}

export const COLOR_ORDER = ["Red", "Yellow", "Green", "Blue"] as const;
export const TYPE_ORDER = ["Legend", "Unit", "Gear", "Program"] as const;
export const RARITY_ORDER = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Iconic Legend",
  "Iconic Other",
  "Iconic Secret",
  "Nova Rare",
  "Secret",
] as const;

export const CONDITIONS = [
  { code: "NM", name: "Near Mint", sortOrder: 0 },
  { code: "LP", name: "Lightly Played", sortOrder: 1 },
  { code: "MP", name: "Moderately Played", sortOrder: 2 },
  { code: "HP", name: "Heavily Played", sortOrder: 3 },
  { code: "DMG", name: "Damaged", sortOrder: 4 },
] as const;

export const PRICE_SOURCES = [
  { code: "cardmarket", name: "Cardmarket" },
  { code: "ebay", name: "eBay" },
  { code: "other", name: "Autre" },
] as const;

export const PAGE_SIZE = 200;

export const LANGUAGE_LABELS: Record<string, string> = {
  en: "Anglais",
  fr: "Français",
};
