// Scores autorisés, gagnant et points de match (cf. specs/tournaments/match-reporting et standings).

export type MatchType = "bo1" | "bo3";
export type Phase = "swiss" | "top_cut";
export type MatchKind = "normal" | "bye" | "double_loss" | "id" | "no_show";

/** Résultat saisi : manches gagnées par A et par B, et nature du résultat. */
export type MatchResult = { kind: MatchKind; gamesA: number; gamesB: number };

export type Winner = "A" | "B" | "draw" | "none";

export const POINTS_WIN = 3;
export const POINTS_DRAW = 1;

export function maxGames(matchType: MatchType) {
  return matchType === "bo3" ? 2 : 1;
}

/** Score d'une victoire sans jeu (bye, no-show) : 2-0 en Bo3, 1-0 en Bo1. */
export function walkoverGames(matchType: MatchType) {
  return maxGames(matchType);
}

/** Message d'erreur si le résultat n'est pas autorisé, sinon null. */
export function resultError(result: MatchResult, matchType: MatchType, phase: Phase): string | null {
  const { kind, gamesA, gamesB } = result;
  if (!Number.isInteger(gamesA) || !Number.isInteger(gamesB) || gamesA < 0 || gamesB < 0) {
    return "Score invalide.";
  }
  if (kind === "double_loss" || kind === "id") {
    if (phase === "top_cut") return "Un vainqueur est requis en top cut.";
    if (gamesA !== 0 || gamesB !== 0) return "Score invalide.";
    return null;
  }
  const max = maxGames(matchType);
  if (gamesA > max || gamesB > max) return "Score invalide.";
  if (matchType === "bo3" && gamesA === 2 && gamesB === 2) return "Score invalide.";
  if (matchType === "bo1" && gamesA + gamesB > 1) return "Score invalide.";
  if (phase === "top_cut" && gamesA === gamesB) return "Un vainqueur est requis en top cut.";
  return null;
}

export function winnerOf(result: MatchResult): Winner {
  if (result.kind === "double_loss") return "none";
  if (result.kind === "id") return "draw";
  if (result.gamesA > result.gamesB) return "A";
  if (result.gamesB > result.gamesA) return "B";
  return "draw";
}

/** Points de match rapportés par un résultat validé de phase suisse. */
export function matchPoints(result: MatchResult): { a: number; b: number } {
  switch (winnerOf(result)) {
    case "A":
      return { a: POINTS_WIN, b: 0 };
    case "B":
      return { a: 0, b: POINTS_WIN };
    case "draw":
      return { a: POINTS_DRAW, b: POINTS_DRAW };
    default:
      return { a: 0, b: 0 };
  }
}

export function sameResult(x: MatchResult, y: MatchResult) {
  return x.kind === y.kind && x.gamesA === y.gamesA && x.gamesB === y.gamesB;
}
