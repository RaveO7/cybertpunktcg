// Identité d'une ligne de collection : carte × état × prix d'achat unitaire (et devise) × date d'achat × notes.
// Deux exemplaires qui ne partagent pas ces valeurs ne peuvent pas être dans la même ligne :
// un ajout identique cumule la quantité, un ajout différent crée une nouvelle ligne.
// Partagé par le serveur (collection-mutate) et l'affichage hors ligne (offline-queue).

export type LineFields = {
  conditionCode: string;
  notes?: string | null;
  purchasePrice?: string | { toString(): string } | null;
  purchaseCurrency?: string | null;
  purchasedAt?: string | Date | null;
};

/** Notes comparables : espaces retirés, vide = pas de notes. */
export function lineNotes(notes: string | null | undefined): string | null {
  const trimmed = notes?.trim();
  return trimmed ? trimmed : null;
}

/** Prix comparable au centime (« 3,5 », « 3.50 » et un Decimal 3.5 sont égaux), ou null. */
export function linePrice(price: string | { toString(): string } | null | undefined): string | null {
  if (price == null) return null;
  const text = price.toString().trim().replace(",", ".");
  if (text === "") return null;
  const amount = Number(text);
  return Number.isFinite(amount) ? amount.toFixed(2) : text;
}

/** Date d'achat comparable (« AAAA-MM-JJ », jour UTC), ou null. */
export function lineDate(date: string | Date | null | undefined): string | null {
  if (date == null) return null;
  if (date instanceof Date) return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  const text = date.trim();
  return text === "" ? null : text.slice(0, 10);
}

/** Clé d'identité ; la devise ne compte que s'il y a un prix. */
export function lineKey(line: LineFields): string {
  const price = linePrice(line.purchasePrice);
  const currency = price == null ? "" : line.purchaseCurrency || "EUR";
  return JSON.stringify([line.conditionCode, price, currency, lineDate(line.purchasedAt), lineNotes(line.notes)]);
}

export function sameLine(left: LineFields, right: LineFields): boolean {
  return lineKey(left) === lineKey(right);
}

/**
 * Ligne existante qui accueille un ajout (lignes d'une même carte). Un champ fourni, même `null`
 * (« sans prix », « sans date », « sans notes »), doit être égal ; un champ absent (`undefined`) ne départage pas :
 * on prend alors de préférence la ligne sans cette valeur, sinon la première.
 * La devise ne compte que si le prix est fourni.
 */
export function matchLine<T extends LineFields>(lines: T[], query: LineFields): T | undefined {
  const price = query.purchasePrice === undefined ? undefined : linePrice(query.purchasePrice);
  const currency = price == null ? null : query.purchaseCurrency || "EUR";
  const matching = lines.filter((line) => {
    if (line.conditionCode !== query.conditionCode) return false;
    if (query.notes !== undefined && lineNotes(line.notes) !== lineNotes(query.notes)) return false;
    if (query.purchasedAt !== undefined && lineDate(line.purchasedAt) !== lineDate(query.purchasedAt)) return false;
    if (price === undefined) return true;
    const linePriceValue = linePrice(line.purchasePrice);
    if (linePriceValue !== price) return false;
    return price == null || (line.purchaseCurrency || "EUR") === currency;
  });
  return (
    matching.find(
      (line) =>
        (query.notes !== undefined || lineNotes(line.notes) == null) &&
        (query.purchasedAt !== undefined || lineDate(line.purchasedAt) == null) &&
        (price !== undefined || linePrice(line.purchasePrice) == null),
    ) ?? matching[0]
  );
}

/** Valeurs d'une nouvelle ligne : un champ absent vaut « sans ». */
export function newLineFields(query: Omit<LineFields, "conditionCode">) {
  const purchasePrice = linePrice(query.purchasePrice);
  return {
    notes: lineNotes(query.notes),
    purchasePrice,
    purchaseCurrency: purchasePrice == null ? null : query.purchaseCurrency || "EUR",
    purchasedAt: purchaseDay(query.purchasedAt),
  };
}

/** Date d'achat en jour UTC à minuit (valeur enregistrée en base), ou null. */
export function purchaseDay(date: string | Date | null | undefined): Date | null {
  const day = lineDate(date);
  return day == null ? null : new Date(`${day}T00:00:00.000Z`);
}
