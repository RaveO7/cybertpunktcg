/** Achat placé sur la courbe (le jour du point, ou le premier jour d'historique qui suit). */
export type ChartPurchase = {
  /** Date réelle de l'achat « AAAA-MM-JJ ». */
  day: string;
  title: string;
  quantity: number;
  unitPrice: number | null;
  currency: string | null;
};

export type ChartPoint = {
  day: string;
  value: number;
  /** Prix d'achat cumulé à ce jour : tracé en pointillés quand il est fourni. */
  invested?: number | null;
  /** Plus / moins-value à ce jour (exemplaires avec prix d'achat). */
  profit?: number | null;
  purchases?: ChartPurchase[];
};
