import { BETA_SET_CODE, FRENCH_SOURCE_SET_CODE, isSealedSetCode, MAIN_SET_CODE } from "@/lib/reference-data";
import type { Filters, PrintingDTO, SetDTO } from "@/lib/types";

/** Mêmes critères de liste : seule la fiche ouverte (`printingId`) peut différer. */
export function sameListFilters(a: Filters, b: Filters) {
  return (Object.keys(a) as (keyof Filters)[]).every((key) => {
    if (key === "printingId") return true;
    const left = a[key];
    const right = b[key];
    if (Array.isArray(left) && Array.isArray(right)) {
      return left.length === right.length && left.every((value, index) => value === right[index]);
    }
    return left === right;
  });
}

export function resolveOpenedPrinting(printings: PrintingDTO[], printingId: string | null) {
  if (!printingId) return null;
  return printings.find((item) => item.id === printingId) ?? null;
}

const WELCOME_ORDER = [BETA_SET_CODE, MAIN_SET_CODE];

/** Extensions proposées dans le filtre : cartes avant produits scellés, extensions d'accueil d'abord. */
export function orderedSetChoices(sets: SetDTO[]) {
  return sets
    .filter((set) => set.code !== FRENCH_SOURCE_SET_CODE)
    .sort((a, b) => {
      const aSealed = isSealedSetCode(a.code) ? 1 : 0;
      const bSealed = isSealedSetCode(b.code) ? 1 : 0;
      if (aSealed !== bSealed) return aSealed - bSealed;
      const aWelcome = WELCOME_ORDER.indexOf(a.code);
      const bWelcome = WELCOME_ORDER.indexOf(b.code);
      const aRank = aWelcome === -1 ? WELCOME_ORDER.length + a.sortOrder : aWelcome;
      const bRank = bWelcome === -1 ? WELCOME_ORDER.length + b.sortOrder : bWelcome;
      return aRank - bRank;
    });
}

/** Même seuil que `lg:` : au-dessus, les filtres sont une colonne ; en dessous, un tiroir. */
export function isWideLayout() {
  return window.matchMedia("(min-width: 1024px)").matches;
}
