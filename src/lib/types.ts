import type { SORT_KEYS } from "./reference-data";

export type { AuthUser, CollectionItemDTO, DeckDTO, WishlistItemDTO } from "./api-responses";

export type CardDTO = {
  id: string;
  externalId: string;
  slug: string;
  name: string;
  subname: string | null;
  canonicalName: string;
  rulesText: string | null;
  flavorText: string | null;
  color: string | null;
  cardType: string | null;
  isEddiable: boolean | null;
  cost: number | null;
  power: number | null;
  ram: number | null;
  /** « legal », « not-legal » ou null (produits scellés). */
  legality?: string | null;
  tags: string[];
  keywords: string[];
};

export type PrintingDTO = {
  id: string;
  cardId: string;
  externalId: string;
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: string | null;
  language: string;
  localizedName: string | null;
  imagePath: string | null;
  artist: string | null;
  printedRulesText: string | null;
  officialFinish: string | null;
  marketPrice: string | null;
  previousMarketPrice: string | null;
  /** Autres prix du guide Cardmarket (absent si aucun n'est connu). */
  priceGuide?: PriceGuideDTO;
};

/** Prix du guide Cardmarket hors tendance : plus bas, moyenne de vente, moyennes 7 et 30 jours. */
export type PriceGuideDTO = {
  low?: string;
  avg?: string;
  avg7?: string;
  avg30?: string;
};

export type SetDTO = {
  code: string;
  name: string;
  number: number | null;
  releaseDate: string | null;
  logoUrl: string | null;
  description: string | null;
  cardCount: number;
  status: string;
  sortOrder: number;
};

export type ConditionDTO = {
  code: string;
  name: string;
  sortOrder: number;
};

export type CatalogDTO = {
  sets: SetDTO[];
  conditions: ConditionDTO[];
  cards: CardDTO[];
  printings: PrintingDTO[];
  hasPrices: boolean;
};

export type CollectionFilter = "all" | "owned" | "missing" | "duplicates";

export type SortKey = (typeof SORT_KEYS)[number];

export type Filters = {
  q: string;
  language: string;
  set: string;
  colors: string[];
  types: string[];
  tags: string[];
  keywords: string[];
  costs: string[];
  powers: string[];
  rams: string[];
  artists: string[];
  eddiable: "" | "true" | "false";
  rarity: string;
  collection: CollectionFilter;
  condition: string;
  sort: SortKey;
  page: number;
  printingId: string | null;
};

export type Ownership = {
  qty: number;
  conditions: string[];
};

export type Progress = {
  uniqueOwned: number;
  total: number;
  missing: number;
  duplicates: number;
  extraCopies: number;
  totalCopies: number;
  percent: number;
};

export type Facets = {
  languages: string[];
  colors: string[];
  types: string[];
  tags: string[];
  keywords: string[];
  costs: string[];
  powers: string[];
  rams: string[];
  artists: string[];
  rarities: string[];
  eddiable: boolean;
};
