import { useLocale } from "next-intl";
import { useMemo } from "react";
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

export function numberFormat(locale: Locale): NumberFormat {
  const tag = intlLocale(locale);
  const ints = new Intl.NumberFormat(tag);
  const moneys = new Map<string, Intl.NumberFormat>();
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
    percent: (value, digits = 0) =>
      new Intl.NumberFormat(tag, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value / 100),
  };
}

/** Formats de la langue de la page (composants clients). */
export function useNumberFormat(): NumberFormat {
  const locale = useLocale();
  return useMemo(() => numberFormat(locale), [locale]);
}
