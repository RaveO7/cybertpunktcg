// Événement iCalendar (RFC 5545) d'un tournoi public : « Ajouter à mon agenda ».

/** Pause estimée entre deux rondes (appariement, annonces). */
const BREAK_MINUTES = 15;

export function estimatedEnd(startsAt: Date, swissRounds: number, roundMinutes: number) {
  return new Date(startsAt.getTime() + swissRounds * (roundMinutes + BREAK_MINUTES) * 60_000);
}

/** 2026-10-12T14:00:00.000Z → 20261012T140000Z */
function icsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Échappement des valeurs de texte (virgules, points-virgules, retours à la ligne). */
function icsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Lignes repliées à 75 octets (continuation par une espace). */
function fold(line: string) {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const charSize = Buffer.byteLength(char, "utf8");
    if (size + charSize > (parts.length ? 74 : 75)) {
      parts.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += charSize;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export type CalendarEvent = {
  id: string;
  name: string;
  startsAt: Date;
  swissRounds: number;
  roundMinutes: number;
  location: string | null;
  url: string;
  description?: string | null;
  now?: Date;
};

export function tournamentIcs(event: CalendarEvent) {
  const end = estimatedEnd(event.startsAt, event.swissRounds, event.roundMinutes);
  const description = [event.description?.trim(), event.url].filter(Boolean).join("\n\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Cyberpunk TCG//Tournois//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:tournament-${event.id}@cyberpunk-tcg`,
    `DTSTAMP:${icsDate(event.now ?? new Date())}`,
    `DTSTART:${icsDate(event.startsAt)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(event.name)}`,
    ...(event.location ? [`LOCATION:${icsText(event.location)}`] : []),
    `DESCRIPTION:${icsText(description)}`,
    `URL:${event.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}
