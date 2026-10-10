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

export type CollectionItemDTO = {
  id: string;
  printingId: string;
  conditionCode: string;
  conditionName: string;
  quantity: number;
  notes: string | null;
  purchasePrice: string | null;
  purchaseCurrency: string | null;
  addedAt: string;
};

export type WishlistItemDTO = {
  id: string;
  printingId: string;
  /** Prix cible en EUR (2 décimales), null = simple suivi sans alerte. */
  targetPrice: string | null;
  notes: string | null;
  /** Date à laquelle le prix est passé sous la cible (null si la cible n'est pas atteinte). */
  alertAt: string | null;
  alertPrice: string | null;
  alertSeen: boolean;
  createdAt: string;
};

export type DeckDTO = {
  id: string;
  name: string;
  notes: string | null;
  /** Cartes de jeu (Card.id) et nombre d'exemplaires, Legends comprises. */
  cards: { cardId: string; quantity: number }[];
  createdAt: string;
  updatedAt: string;
};

export type CatalogDTO = {
  sets: SetDTO[];
  conditions: ConditionDTO[];
  cards: CardDTO[];
  printings: PrintingDTO[];
  hasPrices: boolean;
};

export type CollectionFilter = "all" | "owned" | "missing" | "duplicates";

export type SortKey =
  | "default"
  | "number-asc"
  | "number-desc"
  | "cost-asc"
  | "cost-desc"
  | "qty-asc"
  | "qty-desc"
  | "name-asc"
  | "name-desc"
  | "rarity"
  | "set"
  | "owned-first"
  | "missing-first";

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

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
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
