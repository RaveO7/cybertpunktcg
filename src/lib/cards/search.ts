import type {
  CardDTO,
  PrintingDTO,
} from "@/lib/types";

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/β/g, "b")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function numberParts(value: string) {
  const normalized = value.toLowerCase().replace(/β/g, "b").replace(/\s+/g, "");
  const match = normalized.match(/^(?:b)?0*(\d+)([a-z]*)$/);
  if (!match) return null;
  return { n: Number(match[1]), suffix: match[2] ?? "" };
}

export function numberMatches(collectorNumber: string, token: string) {
  const query = token.trim().toLowerCase().replace(/β/g, "b");
  if (!query) return false;
  const card = numberParts(collectorNumber);
  const wanted = numberParts(query);
  if (wanted) {
    if (!card || card.n !== wanted.n) return false;
    return !wanted.suffix || card.suffix === wanted.suffix;
  }
  const compactCard = collectorNumber.toLowerCase().replace(/β/g, "b").replace(/\s+/g, "");
  return compactCard.includes(query.replace(/\s+/g, ""));
}

/** Texte normalisé d'un tirage (ou d'une carte), découpé une seule fois pour la recherche. */
export type SearchEntry = {
  /** Variantes du nom (nom canonique, nom + sous-titre, nom localisé), normalisées. */
  names: string[];
  nameText: string;
  nameWords: string[];
  /** Extension, tags… : correspondance exacte seulement. */
  otherText: string;
  /** Texte de règles : correspondance exacte seulement. */
  rulesText: string;
  collectorNumber: string | null;
};

function searchEntry(
  names: (string | null | undefined)[],
  other: (string | null | undefined)[],
  rules: (string | null | undefined)[],
  collectorNumber: string | null,
): SearchEntry {
  const normalizedNames = [...new Set(names.filter(Boolean).map((name) => normalizeText(name!)).filter(Boolean))];
  const nameText = normalizedNames.join(" ");
  return {
    names: normalizedNames,
    nameText,
    nameWords: [...new Set(nameText.split(" ").filter(Boolean))],
    otherText: normalizeText(other.filter(Boolean).join(" ")),
    rulesText: normalizeText(rules.filter(Boolean).join(" ")),
    collectorNumber,
  };
}

// Le catalogue garde les mêmes objets d'un rendu à l'autre : l'index est construit une fois par tirage.
const printingEntries = new WeakMap<PrintingDTO, SearchEntry>();
const cardEntries = new WeakMap<CardDTO, SearchEntry>();

export function printingSearchEntry(card: CardDTO, printing: PrintingDTO) {
  let entry = printingEntries.get(printing);
  if (!entry) {
    entry = searchEntry(
      [card.canonicalName, card.name, card.subname ? `${card.name} ${card.subname}` : null, printing.localizedName],
      [printing.setName, printing.setCode],
      [card.rulesText, printing.printedRulesText],
      printing.collectorNumber,
    );
    printingEntries.set(printing, entry);
  }
  return entry;
}

/** Carte sans tirage (navigateur des decks) : tags et mots-clés en correspondance exacte. */
export function cardSearchEntry(card: CardDTO) {
  let entry = cardEntries.get(card);
  if (!entry) {
    entry = searchEntry(
      [card.canonicalName, card.name, card.subname ? `${card.name} ${card.subname}` : null],
      [...card.tags, ...card.keywords],
      [card.rulesText],
      null,
    );
    cardEntries.set(card, entry);
  }
  return entry;
}

/**
 * Distance de Damerau-Levenshtein (transpositions de lettres voisines), bornée :
 * renvoie max + 1 dès que la distance dépasse max.
 */
export function boundedEditDistance(a: string, b: string, max: number) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a === b) return 0;
  let before = new Array<number>(b.length + 1).fill(0);
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  let current = new Array<number>(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, before[j - 2] + 1);
      }
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    [before, previous, current] = [previous, current, before];
  }
  return previous[b.length];
}

/** Fautes tolérées : aucune sous 5 caractères, 1 jusqu'à 8, 2 à partir de 9. */
function typoTolerance(word: string) {
  if (word.length < 5) return 0;
  return word.length >= 9 ? 2 : 1;
}

function approximateNameMatch(entry: SearchEntry, word: string) {
  const max = typoTolerance(word);
  if (max === 0 || word.includes(" ")) return false;
  return entry.nameWords.some((nameWord) => boundedEditDistance(word, nameWord, max) <= max);
}

function isNumberToken(token: string) {
  return /^(?:β|b)?\d+[a-z]*$/i.test(token);
}

/** Paliers de pertinence de searchScore. */
export const SEARCH_SCORE = { exactName: 5, namePrefix: 4, inName: 3, approximate: 2, rules: 1 } as const;

/**
 * Pertinence d'une entrée pour la saisie : null si un mot ne correspond pas,
 * sinon 5 nom identique, 4 nom qui commence par la saisie, 3 tous les mots dans le nom,
 * 2 correspondance approchée, 1 texte de règles (ou extension, tags) seulement.
 * Un mot qui ressemble à un numéro est comparé au numéro du tirage et n'influe pas sur le palier.
 */
export function searchScore(entry: SearchEntry, query: string): number | null {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return SEARCH_SCORE.exactName;
  let approximate = false;
  let outsideName = false;
  const words: string[] = [];
  for (const token of tokens) {
    if (isNumberToken(token)) {
      if (entry.collectorNumber == null || !numberMatches(entry.collectorNumber, token)) return null;
      continue;
    }
    const word = normalizeText(token);
    if (!word) continue;
    words.push(word);
    if (entry.nameText.includes(word)) continue;
    if (approximateNameMatch(entry, word)) {
      approximate = true;
      continue;
    }
    if (entry.otherText.includes(word) || entry.rulesText.includes(word)) {
      outsideName = true;
      continue;
    }
    return null;
  }
  if (outsideName) return SEARCH_SCORE.rules;
  if (approximate) return SEARCH_SCORE.approximate;
  if (words.length === 0) return SEARCH_SCORE.inName;
  const phrase = words.join(" ");
  if (entry.names.includes(phrase)) return SEARCH_SCORE.exactName;
  if (entry.names.some((name) => name.startsWith(phrase))) return SEARCH_SCORE.namePrefix;
  return SEARCH_SCORE.inName;
}

export function matchesSearch(card: CardDTO, printing: PrintingDTO, query: string) {
  if (!query.trim()) return true;
  return searchScore(printingSearchEntry(card, printing), query) !== null;
}

/** Classe par pertinence décroissante ; Array.prototype.sort est stable, l'ordre reçu départage. */
export function rankBySearch<T>(list: T[], query: string, entryOf: (value: T) => SearchEntry | null) {
  if (!query.trim()) return list;
  const scores = new Map<T, number>();
  for (const value of list) {
    const entry = entryOf(value);
    scores.set(value, entry ? (searchScore(entry, query) ?? 0) : 0);
  }
  return [...list].sort((a, b) => scores.get(b)! - scores.get(a)!);
}

