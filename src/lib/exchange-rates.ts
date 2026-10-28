// Taux de change de référence de la BCE (unités de devise pour 1 EUR, un par jour ouvré), importés chaque
// jour par le cron des prix. Servent à convertir en euros les achats et les ventes saisis en USD ou GBP :
// un montant est converti au taux du jour de l'achat (ou de la vente), sinon au dernier taux publié avant.
import type { PrismaClient } from "@prisma/client";
import { parseRateKey, rateKey } from "./logic";
import { CURRENCIES } from "./parse";
import { shiftUtcDay, utcDay, utcDayKey } from "./price-history";

const ECB_BASE = "https://www.ecb.europa.eu/stats/eurofxref";

/** Devises converties : celles proposées à la saisie, sauf l'euro. */
export const FOREIGN_CURRENCIES: readonly string[] = CURRENCIES.filter((code) => code !== "EUR");

/** Au-delà, l'import repart de l'historique complet plutôt que des 90 derniers jours. */
const RECENT_FILE_DAYS = 80;

export type RateRow = { currency: string; day: string; rate: number };

/**
 * Lit un fichier « eurofxref » de la BCE (jour, 90 derniers jours ou historique complet) :
 * `<Cube time="AAAA-MM-JJ"><Cube currency="USD" rate="1.0956"/>…</Cube>`. Seules `currencies` sont gardées.
 */
export function parseEcbRates(xml: string, currencies: readonly string[] = FOREIGN_CURRENCIES): RateRow[] {
  const wanted = new Set(currencies);
  const rows: RateRow[] = [];
  // Les taux d'un jour sont des balises fermantes seules : le premier « </Cube> » ferme le jour.
  for (const day of xml.matchAll(/<Cube\s+time=["'](\d{4}-\d{2}-\d{2})["']\s*>([\s\S]*?)<\/Cube>/g)) {
    for (const entry of day[2].matchAll(/<Cube\s+currency=["']([A-Z]{3})["']\s+rate=["']([0-9.]+)["']\s*\/>/g)) {
      const rate = Number(entry[2]);
      if (wanted.has(entry[1]) && Number.isFinite(rate) && rate > 0) rows.push({ currency: entry[1], day: day[1], rate });
    }
  }
  return rows;
}

export type ExchangeRateSyncReport = { file: string; read: number; written: number };

/**
 * Ajoute les taux publiés depuis le dernier import. Base vide (ou import arrêté depuis longtemps) :
 * tout l'historique de la BCE ; sinon le fichier des 90 derniers jours.
 */
export async function syncExchangeRates(
  client: PrismaClient,
  options: { fetch?: typeof fetch } = {},
): Promise<ExchangeRateSyncReport> {
  const latest = await client.exchangeRate.groupBy({ by: ["currency"], _max: { day: true } });
  const lastDay = new Map(latest.map((row) => [row.currency, row._max.day ? utcDayKey(row._max.day) : null]));
  const recentLimit = utcDayKey(shiftUtcDay(utcDay(), -RECENT_FILE_DAYS));
  const full = FOREIGN_CURRENCIES.some((currency) => {
    const day = lastDay.get(currency);
    return day == null || day < recentLimit;
  });
  const file = full ? "eurofxref-hist.xml" : "eurofxref-hist-90d.xml";
  const response = await (options.fetch ?? fetch)(`${ECB_BASE}/${file}`, { headers: { accept: "application/xml" } });
  if (!response.ok) throw new Error(`Taux BCE indisponibles (HTTP ${response.status}).`);
  const rows = parseEcbRates(await response.text());
  const fresh = rows.filter((row) => {
    const last = lastDay.get(row.currency);
    return last == null || row.day > last;
  });
  for (let index = 0; index < fresh.length; index += 500) {
    await client.exchangeRate.createMany({
      data: fresh.slice(index, index + 500).map((row) => ({ currency: row.currency, day: utcDay(row.day), rate: String(row.rate) })),
    });
  }
  return { file, read: rows.length, written: fresh.length };
}

/** Taux d'un jour dans une série triée : le dernier publié ce jour-là ou avant, sinon le premier connu. */
export function pickRate(series: readonly { day: string; rate: number }[], day: string): number | null {
  if (series.length === 0) return null;
  let low = 0;
  let high = series.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (series[middle].day <= day) {
      found = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  return series[found === -1 ? 0 : found].rate;
}

/**
 * Taux de chaque couple « devise:jour » demandé (clés de `rateKey`), en une requête par devise.
 * Devise inconnue ou aucun taux importé : la clé est absente (le montant reste non converti).
 */
export async function loadExchangeRates(client: PrismaClient, keys: Iterable<string>): Promise<Record<string, number>> {
  const daysByCurrency = new Map<string, Set<string>>();
  for (const key of keys) {
    const pair = parseRateKey(key);
    if (!pair || !FOREIGN_CURRENCIES.includes(pair.currency)) continue;
    const days = daysByCurrency.get(pair.currency) ?? new Set<string>();
    days.add(pair.day);
    daysByCurrency.set(pair.currency, days);
  }
  const rates: Record<string, number> = {};
  for (const [currency, daySet] of daysByCurrency) {
    const days = [...daySet].sort();
    const first = days[0];
    const last = days[days.length - 1];
    // Quelques jours avant le premier : un achat du week-end prend le taux du vendredi.
    const rows = await client.exchangeRate.findMany({
      where: { currency, day: { gte: shiftUtcDay(first, -10), lte: utcDay(last) } },
      orderBy: { day: "asc" },
      select: { day: true, rate: true },
    });
    const series = rows.map((row) => ({ day: utcDayKey(row.day), rate: Number(row.rate.toString()) }));
    if (series.length === 0 || series[0].day > first) {
      const before = await client.exchangeRate.findFirst({
        where: { currency, day: { lt: utcDay(first) } },
        orderBy: { day: "desc" },
        select: { day: true, rate: true },
      });
      // Rien avant (achat antérieur aux taux importés) : le premier taux connu après.
      const fallback =
        before ??
        (series.length === 0
          ? await client.exchangeRate.findFirst({ where: { currency }, orderBy: { day: "asc" }, select: { day: true, rate: true } })
          : null);
      if (fallback) series.unshift({ day: utcDayKey(fallback.day), rate: Number(fallback.rate.toString()) });
    }
    for (const day of days) {
      const rate = pickRate(series, day);
      if (rate != null && Number.isFinite(rate) && rate > 0) rates[rateKey(currency, day)] = rate;
    }
  }
  return rates;
}
