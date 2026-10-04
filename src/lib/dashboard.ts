import { LANGUAGE_LABELS, isSealedSetCode } from "./reference-data";
import type { PrintingDTO, SetDTO } from "./types";

/** Le dernier jeu sert de repli. Un nouveau TCG s'insère avant, avec un test sur le code ou le nom. */
export const GAMES: { id: string; name: string; test: (set: Pick<SetDTO, "code" | "name">) => boolean }[] = [
  { id: "cyberpunk", name: "Cyberpunk TCG", test: () => true },
];

const GROUP_ORDER = ["Extensions", "Decks", "Promos", "Événements", "Produits annexes", "Scellé"];

export function gameForSet(set: Pick<SetDTO, "code" | "name">) {
  return GAMES.find((game) => game.test(set)) ?? GAMES[GAMES.length - 1];
}

export function productGroup(name: string, code?: string) {
  if (code && isSealedSetCode(code)) return "Scellé";
  const value = name.toLowerCase();
  if (value.includes("promo")) return "Promos";
  if (value.includes("starter") || value.includes("demo") || /\bdeck\b/.test(value)) return "Decks";
  if (value.includes("topper")) return "Produits annexes";
  if (/pre-?\s*release|\bopen\b|\bbrawl\b|\bshowdown\b/.test(value)) return "Événements";
  return "Extensions";
}

export function displaySetName(name: string, language: string) {
  if (language !== "fr") return name;
  return name.replace(/\s+[—–-]\s*FR\s*$/i, "").replace(/\s+FR\s*$/i, "").trim();
}

export function languageLabel(language: string) {
  if (!language) return "Toutes les langues";
  return LANGUAGE_LABELS[language] ?? language;
}

export function gamesInCatalog(sets: SetDTO[], printings: PrintingDTO[]) {
  const codes = new Set(printings.map((printing) => printing.setCode));
  const present = new Map<string, string>();
  for (const set of sets) {
    if (!codes.has(set.code) || isSealedSetCode(set.code)) continue;
    const game = gameForSet(set);
    present.set(game.id, game.name);
  }
  return [...present.entries()].map(([id, name]) => ({ id, name }));
}

export function languagesFor(printings: PrintingDTO[], setCodes: Set<string>) {
  const languages = new Set<string>();
  for (const printing of printings) {
    if (setCodes.has(printing.setCode)) languages.add(printing.language);
  }
  const preferred = ["en", "fr"];
  return [...languages].sort((a, b) => {
    const ai = preferred.indexOf(a);
    const bi = preferred.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

export type DashboardExtension = {
  code: string;
  name: string;
  language: string;
  group: string;
  sortOrder: number;
  total: number;
};

export function extensionsFor(sets: SetDTO[], printings: PrintingDTO[], gameId: string, language: string) {
  const counts = new Map<string, number>();
  for (const printing of printings) {
    if (printing.language !== language) continue;
    counts.set(printing.setCode, (counts.get(printing.setCode) ?? 0) + 1);
  }
  const extensions: DashboardExtension[] = [];
  for (const set of sets) {
    const total = counts.get(set.code) ?? 0;
    if (total === 0 || isSealedSetCode(set.code) || gameForSet(set).id !== gameId) continue;
    extensions.push({
      code: set.code,
      name: displaySetName(set.name, language),
      language,
      group: productGroup(set.name, set.code),
      sortOrder: set.sortOrder,
      total,
    });
  }
  extensions.sort((a, b) => b.total - a.total || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "fr"));
  return extensions;
}

export function groupExtensions(extensions: DashboardExtension[]) {
  const groups = new Map<string, DashboardExtension[]>();
  for (const extension of extensions) {
    const list = groups.get(extension.group) ?? [];
    list.push(extension);
    groups.set(extension.group, list);
  }
  return [...groups.entries()]
    .sort((a, b) => {
      const ai = GROUP_ORDER.indexOf(a[0]);
      const bi = GROUP_ORDER.indexOf(b[0]);
      return (ai === -1 ? GROUP_ORDER.length : ai) - (bi === -1 ? GROUP_ORDER.length : bi);
    })
    .map(([group, items]) => ({ group, extensions: items }));
}

export function scopeKey(gameId: string, language: string) {
  return `${gameId}:${language}`;
}
