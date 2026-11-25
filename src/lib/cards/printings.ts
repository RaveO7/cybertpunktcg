import {
  ALL_SETS_ID,
  BETA_SET_CODE,
  BOTH_LANGUAGES_SET_ID,
  ENGLISH_SET_ID,
  ENGLISH_SET_NAME,
  FRENCH_SET_ID,
  FRENCH_SET_NAME,
  FRENCH_SOURCE_SET_CODE,
  isSealedSetCode,
  isSetList,
  joinSetList,
  MAIN_SET_CODE,
  parseSetList,
  RELEASED_SET_ID,
} from "@/lib/reference-data";
import type {
  CardDTO,
  Ownership,
  PrintingDTO,
} from "@/lib/types";

// Mêmes ordres que localeCompare(…, "fr"[, { numeric: true }]), sans recréer un comparateur à chaque appel.
const frenchOrder = new Intl.Collator("fr");
const frenchNumericOrder = new Intl.Collator("fr", { numeric: true });

export function baseCollectorNumber(value: string) {
  return value.replace(/^β/iu, "");
}

export function printingIdentity(printing: Pick<PrintingDTO, "cardId" | "collectorNumber" | "language">) {
  return `${printing.language}|${printing.cardId}|${baseCollectorNumber(printing.collectorNumber)}`;
}

export function isReleasedSet(setId: string) {
  return (
    setId === RELEASED_SET_ID ||
    setId === ENGLISH_SET_ID ||
    setId === FRENCH_SET_ID ||
    setId === BOTH_LANGUAGES_SET_ID
  );
}

export function extensionValue(set: string) {
  if (set === FRENCH_SOURCE_SET_CODE || set === FRENCH_SET_ID) return MAIN_SET_CODE;
  return set;
}

export function normalizeSetCode(setId: string) {
  if (setId === RELEASED_SET_ID || setId === BOTH_LANGUAGES_SET_ID) return ENGLISH_SET_ID;
  if (setId === FRENCH_SET_ID) return FRENCH_SOURCE_SET_CODE;
  return setId;
}

function presentReleased(printing: PrintingDTO, setId: string, setName: string): PrintingDTO {
  return { ...printing, setCode: setId, setName };
}

export function englishChecklist(printings: PrintingDTO[]) {
  const retail = printings.filter((printing) => printing.setCode === MAIN_SET_CODE && printing.language === "en");
  const beta = printings.filter((printing) => printing.setCode === BETA_SET_CODE && printing.language === "en");
  const retailKeys = new Set(retail.map(printingIdentity));
  const extras = beta.filter((printing) => !retailKeys.has(printingIdentity(printing)));
  return [...retail, ...extras].map((printing) => presentReleased(printing, ENGLISH_SET_ID, ENGLISH_SET_NAME));
}

export function frenchChecklist(printings: PrintingDTO[]) {
  return printings
    .filter((printing) => printing.setCode === FRENCH_SOURCE_SET_CODE)
    .map((printing) => presentReleased(printing, FRENCH_SET_ID, FRENCH_SET_NAME));
}

export function releasedChecklist(printings: PrintingDTO[], setId: string) {
  if (setId === ENGLISH_SET_ID) return englishChecklist(printings);
  if (setId === FRENCH_SET_ID) return frenchChecklist(printings);
  if (setId === RELEASED_SET_ID || setId === BOTH_LANGUAGES_SET_ID) {
    return [...englishChecklist(printings), ...frenchChecklist(printings)];
  }
  return null;
}

/**
 * Liste de l'écran Cartes : beta et retail y sont des cartes distinctes, chacune avec sa
 * propre possession (le résumé fusionné de `releasedChecklist` reste pour les stats).
 */
export function browseChecklist(printings: PrintingDTO[], setId: string) {
  if (setId === ENGLISH_SET_ID) {
    return printings.filter(
      (printing) =>
        (printing.setCode === MAIN_SET_CODE || printing.setCode === BETA_SET_CODE) && printing.language === "en",
    );
  }
  return releasedChecklist(printings, setId);
}

export function equivalentPrintingIds(printing: Pick<PrintingDTO, "cardId" | "collectorNumber" | "language">, all: PrintingDTO[]) {
  const key = printingIdentity(printing);
  return all.filter((item) => printingIdentity(item) === key).map((item) => item.id);
}

function ownershipPool(setId: string, printings: PrintingDTO[]) {
  if (setId === ENGLISH_SET_ID) {
    return printings.filter(
      (printing) => printing.setCode === MAIN_SET_CODE || printing.setCode === BETA_SET_CODE,
    );
  }
  if (setId === FRENCH_SET_ID) {
    return printings.filter((printing) => printing.setCode === FRENCH_SOURCE_SET_CODE);
  }
  return printings;
}

export function viewOwnership(setId: string, printings: PrintingDTO[], agg: Map<string, Ownership>) {
  const checklist = releasedChecklist(printings, setId);
  if (!checklist) return agg;
  return mergeEquivalentOwnership(checklist, ownershipPool(setId, printings), agg);
}

export function mergeEquivalentOwnership(
  checklist: PrintingDTO[],
  all: PrintingDTO[],
  agg: Map<string, Ownership>,
) {
  const idsByIdentity = new Map<string, string[]>();
  for (const printing of all) {
    const key = printingIdentity(printing);
    const ids = idsByIdentity.get(key) ?? [];
    ids.push(printing.id);
    idsByIdentity.set(key, ids);
  }
  const merged = new Map(agg);
  for (const printing of checklist) {
    const ids = idsByIdentity.get(printingIdentity(printing)) ?? [printing.id];
    const combined: Ownership = { qty: 0, conditions: [] };
    for (const id of ids) {
      const owned = agg.get(id);
      if (!owned) continue;
      combined.qty += owned.qty;
      for (const condition of owned.conditions) {
        if (!combined.conditions.includes(condition)) combined.conditions.push(condition);
      }
    }
    if (combined.qty > 0) merged.set(printing.id, combined);
  }
  return merged;
}

export function isEnglishWelcome(set: string) {
  return set === ENGLISH_SET_ID || set === MAIN_SET_CODE || set === BETA_SET_CODE;
}

export function setForLanguage(
  set: string,
  language: string,
  printings: Pick<PrintingDTO, "setCode">[],
) {
  if (!language || set === ALL_SETS_ID) return null;
  if (isSetList(set)) {
    const mapped = joinSetList(parseSetList(set).map((code) => setForLanguage(code, language, printings) ?? code));
    return mapped === set ? null : mapped;
  }
  const codes = new Set(printings.map((printing) => printing.setCode));
  if (language === "fr") {
    if (isEnglishWelcome(set)) return codes.has(FRENCH_SOURCE_SET_CODE) ? FRENCH_SOURCE_SET_CODE : null;
    if (set.endsWith("-fr")) return null;
    const twin = `${set}-fr`;
    return codes.has(twin) ? twin : null;
  }
  if (language === "en") {
    if (set === FRENCH_SOURCE_SET_CODE || set === FRENCH_SET_ID) return MAIN_SET_CODE;
    if (!set.endsWith("-fr")) return null;
    const base = set.slice(0, -3);
    return codes.has(base) ? base : null;
  }
  return null;
}

export function languageOptions(
  set: string,
  printings: Pick<PrintingDTO, "setCode" | "language">[],
  facetLanguages: string[],
): string[] {
  if (isSetList(set)) {
    const merged = parseSetList(set).flatMap((code) => languageOptions(code, printings, facetLanguages));
    return [...new Set(merged)];
  }
  const codes = new Set(printings.map((printing) => printing.setCode));
  const options = new Set(facetLanguages);
  if (isEnglishWelcome(set) || set === FRENCH_SOURCE_SET_CODE || set === FRENCH_SET_ID) {
    if (codes.has(BETA_SET_CODE) || codes.has(MAIN_SET_CODE)) options.add("en");
    if (codes.has(FRENCH_SOURCE_SET_CODE)) options.add("fr");
  } else if (set.endsWith("-fr")) {
    options.add("fr");
    if (codes.has(set.slice(0, -3))) options.add("en");
  } else if (isSealedSetCode(set)) {
    options.add("en");
    options.add("fr");
  } else if (set !== ALL_SETS_ID && codes.has(`${set}-fr`)) {
    options.add("en");
    options.add("fr");
  }
  const preferred = ["en", "fr"].filter((language) => options.has(language));
  const extra = [...options].filter((language) => language !== "en" && language !== "fr").sort();
  return [...preferred, ...extra];
}

export function printingTitle(card: CardDTO | undefined, printing: PrintingDTO) {
  return printing.localizedName || card?.canonicalName || card?.name || "Carte";
}

/** Autres éditions d'une carte (fiche carte), par extension puis par numéro. */
export function siblingPrintings(printings: PrintingDTO[], printing: Pick<PrintingDTO, "id" | "cardId">) {
  return printings
    .filter((entry) => entry.cardId === printing.cardId && entry.id !== printing.id)
    .sort(
      (a, b) =>
        frenchOrder.compare(a.setName, b.setName) || frenchNumericOrder.compare(a.collectorNumber, b.collectorNumber),
    );
}

/** Prefers official printed rules in the UI locale, falling back to the current printing / English card text. */
export function resolveRulesText(
  card: CardDTO,
  printing: PrintingDTO,
  siblings: PrintingDTO[],
  locale: string,
): { text: string; language: string | null; fromOtherPrinting: boolean } {
  const all = [printing, ...siblings];
  const preferred = all.find((entry) => entry.language === locale && entry.printedRulesText?.trim());
  if (preferred?.printedRulesText) {
    return {
      text: preferred.printedRulesText,
      language: preferred.language,
      fromOtherPrinting: preferred.id !== printing.id,
    };
  }

  if (printing.printedRulesText?.trim()) {
    return {
      text: printing.printedRulesText,
      language: printing.language,
      fromOtherPrinting: false,
    };
  }

  if (card.rulesText?.trim()) {
    return {
      text: card.rulesText,
      language: "en",
      fromOtherPrinting: false,
    };
  }

  const anyPrinted = siblings.find((entry) => entry.printedRulesText?.trim());
  if (anyPrinted?.printedRulesText) {
    return {
      text: anyPrinted.printedRulesText,
      language: anyPrinted.language,
      fromOtherPrinting: true,
    };
  }

  return { text: "", language: null, fromOtherPrinting: false };
}
