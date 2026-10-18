import { useLocale } from "next-intl";
import { intlLocale, type Locale } from "@/i18n/config";

/** Prix, entiers et pourcentages au format régional d'une langue (registre des langues). */
export type NumberFormat = {
  /** « 1 234,50 € » (fr), « €1,234.50 » (en). */
  money: (amount: number, currency?: string) => string;
  /** « 1 234 567 » (fr), « 1.234.567 » (de). */
  int: (value: number) => string;
  /** Valeur déjà en pourcentage : 12,345 → « 12,3 % » (fr), « 12.3% » (en). */
  percent: (value: number, digits?: number) => string;
};

// Créer un Intl.NumberFormat coûte cher : un jeu de formats par langue, partagé par tous les composants.
const formatsByLocale = new Map<Locale, NumberFormat>();

export function numberFormat(locale: Locale): NumberFormat {
  let formats = formatsByLocale.get(locale);
  if (!formats) {
    formats = createNumberFormat(locale);
    formatsByLocale.set(locale, formats);
  }
  return formats;
}

function createNumberFormat(locale: Locale): NumberFormat {
  const tag = intlLocale(locale);
  const ints = new Intl.NumberFormat(tag);
  const moneys = new Map<string, Intl.NumberFormat>();
  const percents = new Map<number, Intl.NumberFormat>();
  return {
    money(amount, currency = "EUR") {
      let format = moneys.get(currency);
      if (!format) {
        format = new Intl.NumberFormat(tag, { style: "currency", currency });
        moneys.set(currency, format);
      }
      return format.format(amount);
    },
    int: (value) => ints.format(value),
    percent(value, digits = 0) {
      let format = percents.get(digits);
      if (!format) {
        format = new Intl.NumberFormat(tag, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits });
        percents.set(digits, format);
      }
      return format.format(value / 100);
    },
  };
}

/** Formats de la langue de la page (composants clients). */
export function useNumberFormat(): NumberFormat {
  return numberFormat(useLocale());
}
