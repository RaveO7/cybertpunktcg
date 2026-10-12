// Périodes de l'annuaire (« ce week-end »…) → bornes de dates. Calculées à l'heure locale de
// l'appareil (le navigateur, ou le serveur pour le premier rendu) : l'URL garde la période,
// pas les dates, pour qu'un lien partagé reste « ce week-end » quand on le rouvre.

export const PERIODS = ["any", "today", "weekend", "week", "month", "custom"] as const;
export type Period = (typeof PERIODS)[number];

export function isPeriod(value: unknown): value is Period {
  return typeof value === "string" && (PERIODS as readonly string[]).includes(value);
}

const DAY = 24 * 60 * 60_000;

function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Bornes [from, to[ d'une période ; `custom` lit les dates AAAA-MM-JJ données (to inclus). */
export function periodRange(period: Period, now: Date, custom: { from?: string; to?: string } = {}): { from?: Date; to?: Date } {
  switch (period) {
    case "any":
      return {};
    case "today":
      return { from: startOfDay(now), to: addDays(startOfDay(now), 1) };
    case "weekend": {
      // Samedi 00:00 → lundi 00:00 ; si l'on est déjà le week-end, à partir d'aujourd'hui.
      const day = now.getDay(); // 0 = dimanche, 6 = samedi
      const saturday = day === 6 ? startOfDay(now) : day === 0 ? addDays(startOfDay(now), -1) : addDays(startOfDay(now), 6 - day);
      return { from: day === 0 || day === 6 ? startOfDay(now) : saturday, to: addDays(saturday, 2) };
    }
    case "week":
      return { from: startOfDay(now), to: new Date(startOfDay(now).getTime() + 7 * DAY) };
    case "month":
      return { from: startOfDay(now), to: new Date(startOfDay(now).getTime() + 30 * DAY) };
    case "custom": {
      const parse = (value?: string) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : undefined);
      const from = parse(custom.from);
      const to = parse(custom.to);
      return { from, to: to ? addDays(to, 1) : undefined };
    }
  }
}
