import { parseCsv } from "./csv";
import type { CardmarketProduct } from "./types";

export function parseProductFile(text: string) {
  const data = parseFile(text);
  if (Array.isArray(data) || isRecord(data)) return parseProducts(data);
  throw new Error("Catalogue produits illisible.");
}

export function parsePriceFile(text: string) {
  return parseTrends(parseFile(text));
}

/** Date `createdAt` en tête du guide de prix Cardmarket, ou null si absente. */
export function parsePriceGuideDate(text: string) {
  const match = /"createdAt"\s*:\s*"([^"]+)"/.exec(text.slice(0, 1000));
  if (!match) return null;
  const date = new Date(match[1].replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseProducts(data: unknown): CardmarketProduct[] {
  const rows = rowsOf(data, ["products", "product"]);
  if (!rows) throw new Error("Catalogue produits illisible.");
  const products: CardmarketProduct[] = [];
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const idProduct = readId(record);
    const name = readString(record, ["name", "Name", "enName"]);
    if (idProduct == null || !name) continue;
    products.push({
      idProduct,
      name,
      expansionName: readExpansionName(record),
      idExpansion: readExpansionId(record),
      number: readCollectorNumber(record, name),
    });
  }
  return products;
}

export function parseTrends(data: unknown) {
  const rows = rowsOf(data, ["priceGuides", "priceguides", "prices"]);
  if (!rows) throw new Error("Guide de prix illisible.");
  const trends = new Map<number, number>();
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const idProduct = readId(record);
    if (idProduct == null) continue;
    const amount = pickMarketAmount(record);
    if (amount == null) continue;
    trends.set(idProduct, amount);
  }
  return trends;
}

function pickMarketAmount(record: Record<string, unknown>) {
  return (
    readEuro(record.trend ?? record["Trend Price"] ?? record.trendPrice ?? record.TREND) ??
    readLow(record) ??
    readAvg(record)
  );
}

function readLow(record: Record<string, unknown>) {
  return readEuro(record.low ?? record["Low Price"] ?? record.lowPrice ?? record.LOW);
}

function readAvg(record: Record<string, unknown>) {
  return readEuro(record.avg ?? record["Avg. Sell Price"] ?? record.avgSellPrice ?? record.AVG ?? record.SELL);
}

/** Prix du guide gardés à côté de la tendance (hors foil, comme elle), en `kind` de `Price`. */
export const GUIDE_DETAIL_KINDS = ["low", "avg", "avg7", "avg30"] as const;
export type GuideDetailKind = (typeof GUIDE_DETAIL_KINDS)[number];
export type GuideDetails = Partial<Record<GuideDetailKind, number>>;

/** Prix le plus bas, moyenne de vente et moyennes 7 / 30 jours de chaque produit (seulement ceux renseignés). */
export function parseGuideDetails(data: unknown) {
  const rows = rowsOf(data, ["priceGuides", "priceguides", "prices"]);
  if (!rows) throw new Error("Guide de prix illisible.");
  const details = new Map<number, GuideDetails>();
  for (const row of rows) {
    const record = asRecord(row);
    if (!record) continue;
    const idProduct = readId(record);
    if (idProduct == null) continue;
    const values: Record<GuideDetailKind, number | null> = {
      low: readLow(record),
      avg: readAvg(record),
      avg7: readEuro(record.avg7 ?? record.AVG7),
      avg30: readEuro(record.avg30 ?? record.AVG30),
    };
    const entry: GuideDetails = {};
    for (const kind of GUIDE_DETAIL_KINDS) {
      const value = values[kind];
      if (value != null) entry[kind] = value;
    }
    if (Object.keys(entry).length > 0) details.set(idProduct, entry);
  }
  return details;
}

export function parseGuideDetailsFile(text: string) {
  return parseGuideDetails(parseFile(text));
}

function parseFile(text: string): unknown {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed) as unknown;
  return csvRecords(trimmed);
}

function csvRecords(text: string) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });
    return record;
  });
}

function rowsOf(data: unknown, keys: string[]) {
  if (Array.isArray(data)) return data;
  const record = asRecord(data);
  if (!record) return null;
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return null;
}

function readExpansionName(record: Record<string, unknown>) {
  const direct = readString(record, ["expansionName", "Expansion", "expansion"]);
  if (direct) return direct;
  const expansion = asRecord(record.expansion);
  const nested = expansion ? readString(expansion, ["enName", "name"]) : null;
  if (nested) return nested;
  const website = readString(record, ["website", "url"]);
  const match = website?.match(/\/Singles\/([^/]+)/i);
  return match ? match[1].replace(/-/g, " ") : null;
}

function readExpansionId(record: Record<string, unknown>) {
  const value = record.idExpansion ?? record["Expansion ID"] ?? record.expansionId;
  const id = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isInteger(id) ? id : null;
}

function readCollectorNumber(record: Record<string, unknown>, name: string) {
  const raw = readString(record, ["number", "Number", "collectorNumber"]);
  const cleaned = raw ? cleanCollectorNumber(raw) : null;
  if (cleaned) return cleaned;
  const match = name.match(/\(\s*((?:β|b)?\d+[a-z]*)\s*\)\s*$/i);
  if (!match || /^v/i.test(match[1])) return null;
  return match[1];
}

function cleanCollectorNumber(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /^(ms|sd|prm|prmb|prr|dd|alpha)\d/i.test(trimmed)) return null;
  return trimmed;
}

function readId(record: Record<string, unknown>) {
  const value = record.idProduct ?? record.idproduct ?? record["idProduct"];
  // Number("") vaut 0 : une cellule vide n'est pas un id produit.
  const id =
    typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isInteger(id) ? id : null;
}

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function readEuro(value: unknown) {
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim().replace(/\s/g, "").replace(",", "."))
        : Number.NaN;
  if (!Number.isFinite(amount)) return null;
  const rounded = Math.round(amount * 100) / 100;
  // Filtré après l'arrondi : 0,004 € deviendrait un prix de 0 €, qui signifie « pas de prix ».
  return rounded > 0 ? rounded : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return asRecord(value) != null;
}
