export function formatDay(day: string, localeTag: string, withYear = false) {
  const date = new Date(`${day}T00:00:00.000Z`);
  return new Intl.DateTimeFormat(localeTag, {
    day: "2-digit",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(date);
}

export function formatDayRange(from: string, to: string, localeTag: string) {
  return `${formatDay(from, localeTag, true)} – ${formatDay(to, localeTag, true)}`;
}

export function formatPct(value: number, localeTag: string) {
  return new Intl.NumberFormat(localeTag, {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value);
}

export const AXIS_FONT_SIZE = { compact: 10, full: 11 } as const;

export function formatAxisMoney(value: number) {
  if (value >= 1000) return `${Math.round(value / 100) / 10}k €`;
  if (value >= 100) return `${Math.round(value)} €`;
  return `${value.toFixed(value < 10 ? 2 : 1)} €`;
}
