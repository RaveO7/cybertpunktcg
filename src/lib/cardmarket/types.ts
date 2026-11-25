export type CardmarketProduct = {
  idProduct: number;
  name: string;
  expansionName: string | null;
  idExpansion: number | null;
  number: string | null;
};

export type LocalSet = { code: string; name: string };

export type LocalPrinting = {
  id: string;
  setCode: string;
  collectorNumber: string;
  name: string;
};

export type PriceAssignment = {
  printingId: string;
  amount: string;
  productId: number;
};

export type MatchReport = {
  assignments: PriceAssignment[];
  products: number;
  pricedProducts: number;
  matchedProducts: number;
  ambiguousProducts: number;
  unknownExpansionProducts: number;
  unknownExpansions: string[];
  unmatchedSamples: string[];
  expansions: { key: string; setCode: string | null; products: number }[];
};
