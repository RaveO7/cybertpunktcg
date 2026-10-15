// Formats d'affichage des tournois publics (date à l'heure du lieu, prix, distance).

import { intlLocale } from "@/i18n/config";

/** « sam. 17 oct., 14:00 » à l'heure du lieu du tournoi (fuseau du navigateur à défaut). */
export function formatStart(iso: string | null, timeZone: string | null, locale: string, style: "short" | "long" = "short") {
  if (!iso) return "";
  const options: Intl.DateTimeFormatOptions =
    style === "long"
      ? { dateStyle: "full", timeStyle: "short" }
      : { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
  try {
    return new Intl.DateTimeFormat(intlLocale(locale), { ...options, ...(timeZone ? { timeZone } : {}) }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat(intlLocale(locale), options).format(new Date(iso));
  }
}

export function formatFee(cents: number | null, currency: string, locale: string, freeLabel: string) {
  if (cents === null) return freeLabel;
  return new Intl.NumberFormat(intlLocale(locale), { style: "currency", currency }).format(cents / 100);
}

export function formatKm(km: number, locale: string) {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: km < 10 ? 1 : 0 }).format(km);
}

/** Valeur d'un <input type="datetime-local"> (heure du navigateur) ↔ ISO. */
export function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromLocalInput(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function browserTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
