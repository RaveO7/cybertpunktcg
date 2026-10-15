// Transitions d'un match : déclaration, confirmation, contestation, saisie organisateur.
// Fonctions pures : elles retournent le nouvel état ou lèvent une TournamentError.
// Chaque joueur déclare dans sa propre case (declA / declB) : deux déclarations ne s'écrasent jamais.

import { fail } from "./errors";
import { resultError, sameResult, walkoverGames, type MatchResult, type MatchType, type Phase } from "./scores";

export type MatchStatus = "en_cours" | "declare" | "conteste" | "valide";
export type Side = "A" | "B";
export type OneDeviceMode = "direct" | "organizer";

export type MatchState = {
  status: MatchStatus;
  kind: MatchResult["kind"];
  gamesA: number | null;
  gamesB: number | null;
  declA: MatchResult | null;
  declB: MatchResult | null;
  declaredAt: Date | null;
  confirmedOnSite: boolean;
  isBye: boolean;
};

export type MatchContext = { matchType: MatchType; phase: Phase; oneDeviceMode: OneDeviceMode; now: Date };

const ALREADY_VALIDATED = "tournaments.alreadyValidated" as const;
const CONTESTED = "tournaments.contested" as const;

export function otherSide(side: Side): Side {
  return side === "A" ? "B" : "A";
}

function declarationOf(state: MatchState, side: Side) {
  return side === "A" ? state.declA : state.declB;
}

function withDeclaration(state: MatchState, side: Side, result: MatchResult | null): MatchState {
  return side === "A" ? { ...state, declA: result } : { ...state, declB: result };
}

function validated(state: MatchState, result: MatchResult): MatchState {
  return { ...state, status: "valide", kind: result.kind, gamesA: result.gamesA, gamesB: result.gamesB };
}

function assertOpenForPlayers(state: MatchState) {
  if (state.isBye) fail("tournaments.byeNoResult");
  if (state.status === "valide") fail(ALREADY_VALIDATED, 409);
  if (state.status === "conteste") fail(CONTESTED, 409);
}

function assertPlayerResult(result: MatchResult, ctx: MatchContext) {
  if (result.kind !== "normal" && result.kind !== "id") fail("tournaments.organizerResultOnly", 403);
  const error = resultError(result, ctx.matchType, ctx.phase);
  if (error) fail(error);
}

/** Déclaration (ou modification de sa déclaration) par un joueur du match. */
export function declareResult(state: MatchState, side: Side, result: MatchResult, ctx: MatchContext): MatchState {
  assertOpenForPlayers(state);
  assertPlayerResult(result, ctx);
  const next = withDeclaration(state, side, result);
  const other = declarationOf(state, otherSide(side));
  if (other) {
    // L'adversaire avait déjà déclaré : identique = validé, différent = contesté.
    return sameResult(other, result) ? validated(next, result) : { ...next, status: "conteste" };
  }
  return { ...next, status: "declare", declaredAt: ctx.now, confirmedOnSite: false };
}

/** L'adversaire du déclarant accepte le score déclaré. */
export function confirmResult(state: MatchState, side: Side): MatchState {
  assertOpenForPlayers(state);
  const declared = declarationOf(state, otherSide(side));
  if (!declared) {
    if (declarationOf(state, side)) fail("tournaments.cannotConfirmOwn");
    fail("tournaments.nothingToConfirm");
  }
  return validated(withDeclaration(state, side, declared), declared);
}

/** L'adversaire du déclarant refuse le score : le match part chez l'organisateur. */
export function refuseResult(state: MatchState, side: Side): MatchState {
  assertOpenForPlayers(state);
  if (!declarationOf(state, otherSide(side))) fail("tournaments.nothingToRefuse");
  return { ...state, status: "conteste" };
}

/**
 * L'adversaire confirme sur le téléphone du déclarant (« Je confirme, je suis X »).
 * Mode direct : validé. Mode organisateur : reste déclaré, marqué « confirmé sur place ».
 */
export function confirmOnSite(state: MatchState, declarerSide: Side, ctx: MatchContext): MatchState {
  assertOpenForPlayers(state);
  const declared = declarationOf(state, declarerSide);
  if (!declared) fail("tournaments.nothingToConfirm");
  const next = { ...withDeclaration(state, otherSide(declarerSide), declared), confirmedOnSite: true };
  return ctx.oneDeviceMode === "direct" ? validated(next, declared) : { ...next, status: "declare" };
}

/** Saisie, validation ou correction par un organisateur, quel que soit l'état du match. */
export function organizerSetResult(state: MatchState, result: MatchResult, ctx: MatchContext): MatchState {
  if (state.isBye) fail("tournaments.byeLocked");
  if (result.kind === "bye" || result.kind === "no_show") fail("tournaments.invalidResult");
  const error = resultError(result, ctx.matchType, ctx.phase);
  if (error) fail(error);
  return validated(state, result);
}

/** Défaite par absence : victoire sans jeu pour l'adversaire. */
export function noShowResult(state: MatchState, absentSide: Side, ctx: MatchContext): MatchState {
  if (state.isBye) fail("tournaments.byeLocked");
  const games = walkoverGames(ctx.matchType);
  return validated(state, {
    kind: "no_show",
    gamesA: absentSide === "A" ? 0 : games,
    gamesB: absentSide === "A" ? games : 0,
  });
}

/** Annulation du résultat par un organisateur : le match redevient en cours. */
export function resetResult(state: MatchState): MatchState {
  if (state.isBye) fail("tournaments.byeLocked");
  return {
    ...state,
    status: "en_cours",
    kind: "normal",
    gamesA: null,
    gamesB: null,
    declA: null,
    declB: null,
    declaredAt: null,
    confirmedOnSite: false,
  };
}

/** Résultat compté au classement (seulement s'il est validé). */
export function resultOf(state: Pick<MatchState, "status" | "kind" | "gamesA" | "gamesB">): MatchResult | null {
  if (state.status !== "valide" || state.gamesA === null || state.gamesB === null) return null;
  return { kind: state.kind, gamesA: state.gamesA, gamesB: state.gamesB };
}

/** Déclaration restée sans réponse plus longtemps que le délai du tournoi. */
export function isOverdue(state: Pick<MatchState, "status" | "declaredAt">, now: Date, timeoutMinutes: number) {
  if (state.status !== "declare" || !state.declaredAt) return false;
  return now.getTime() - state.declaredAt.getTime() > timeoutMinutes * 60_000;
}
