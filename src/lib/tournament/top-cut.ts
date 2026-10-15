// Top cut : taille, qualification (avec tirage au sort visible en cas d'égalité parfaite au
// seuil) et arbre d'élimination directe. Cf. specs/tournaments/pairing et standings.

import { randomInt, type Rng } from "./random";
import { compareStandings, type Standing } from "./standings";
import { fail } from "./errors";

export type TopCutSetting = "aucun" | "auto" | "2" | "4" | "8" | "16" | "32";
export const TOP_CUT_SETTINGS: readonly TopCutSetting[] = ["aucun", "auto", "2", "4", "8", "16", "32"];

/** Tirage au sort enregistré : parmi `tied`, `picked` ont été qualifiés. */
export type CutDraw = { tied: string[]; picked: string[]; at: string };

function largestPowerOfTwoBelow(value: number) {
  let power = 1;
  while (power * 2 < value) power *= 2;
  return power;
}

/** Taille du top cut pour `eligible` joueurs encore en lice (0 = pas de top cut). */
export function cutSize(setting: TopCutSetting, eligible: number) {
  let size: number;
  if (setting === "aucun") size = 0;
  else if (setting === "auto") size = eligible < 9 ? 0 : eligible <= 16 ? 4 : eligible <= 64 ? 8 : 16;
  else size = Number(setting);
  if (size === 0) return 0;
  if (size >= eligible) size = largestPowerOfTwoBelow(eligible);
  return size >= 2 ? size : 0;
}

/** Joueurs pouvant être qualifiés : ni droppés, ni DQ, ni ayant décliné. */
export function cutEligible(standings: readonly Standing[], declined: ReadonlySet<string>) {
  return standings.filter((row) => row.status === "active" && !declined.has(row.playerId));
}

/**
 * Qualifie les `size` premiers. Si le seuil coupe un groupe à égalité parfaite, les places
 * restantes sont tirées au sort parmi ce groupe ; le tirage est retourné pour être enregistré.
 */
export function selectCut(
  eligible: readonly Standing[],
  size: number,
  rng: Rng,
  now: Date,
): { qualified: string[]; draw: CutDraw | null } {
  if (size === 0) return { qualified: [], draw: null };
  if (eligible.length <= size) return { qualified: eligible.map((row) => row.playerId), draw: null };
  const last = eligible[size - 1];
  const next = eligible[size];
  if (compareStandings(last, next) !== 0) {
    return { qualified: eligible.slice(0, size).map((row) => row.playerId), draw: null };
  }
  const groupStart = eligible.findIndex((row) => compareStandings(row, last) === 0);
  let groupEnd = groupStart;
  while (groupEnd < eligible.length && compareStandings(eligible[groupEnd], last) === 0) groupEnd += 1;
  const tied = eligible.slice(groupStart, groupEnd).map((row) => row.playerId);
  const pool = [...tied];
  const picked: string[] = [];
  for (let slots = size - groupStart; slots > 0; slots -= 1) picked.push(pool.splice(randomInt(rng, pool.length), 1)[0]);
  return {
    qualified: [...eligible.slice(0, groupStart).map((row) => row.playerId), ...picked],
    draw: { tied, picked, at: now.toISOString() },
  };
}

/** Ordre des têtes de série dans l'arbre : 1-8, 4-5, 2-7, 3-6 pour 8 (1 et 2 ne se croisent qu'en finale). */
export function bracketSeedOrder(size: number) {
  let order = [1, 2];
  while (order.length < size) {
    const total = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, total - seed]);
  }
  return order;
}

export type BracketMatch = { slot: number; a: string; b: string };

/** Premier tour : `seeds` dans l'ordre du classement suisse. */
export function firstCutRound(seeds: readonly string[]): BracketMatch[] {
  const order = bracketSeedOrder(seeds.length);
  const matches: BracketMatch[] = [];
  for (let i = 0; i < order.length; i += 2) {
    matches.push({ slot: i / 2, a: seeds[order[i] - 1], b: seeds[order[i + 1] - 1] });
  }
  return matches;
}

/** Tour suivant : le vainqueur du slot 2k affronte celui du slot 2k+1, au slot k. */
export function nextCutRound(winnersBySlot: ReadonlyMap<number, string>): BracketMatch[] {
  const count = winnersBySlot.size;
  if (count < 2 || count % 2 !== 0) return [];
  const matches: BracketMatch[] = [];
  for (let slot = 0; slot < count / 2; slot += 1) {
    const a = winnersBySlot.get(2 * slot);
    const b = winnersBySlot.get(2 * slot + 1);
    if (!a || !b) fail("tournaments.incompleteRound");
    matches.push({ slot, a, b });
  }
  return matches;
}

/** Où le vainqueur du slot `slot` joue au tour suivant. */
export function nextSlot(slot: number): { slot: number; side: "A" | "B" } {
  return { slot: Math.floor(slot / 2), side: slot % 2 === 0 ? "A" : "B" };
}
