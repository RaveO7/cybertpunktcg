export const CURRENCIES = ["EUR", "USD", "GBP"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];
const CURRENCY_SET = new Set<string>(CURRENCIES);

export function parseQuantity(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 999) return null;
  return number;
}

export function parseNotes(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 2000) : null;
}

export function parsePrice(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (!Number.isFinite(number) || number < 0 || number > 1_000_000) return null;
  return number.toFixed(2);
}

export function parseCurrency(value: unknown, price: string | null | undefined) {
  if (value === undefined && price === undefined) return undefined;
  if (price === null) return null;
  if (typeof value === "string" && CURRENCY_SET.has(value)) return value;
  if (price) return "EUR";
  return undefined;
}
