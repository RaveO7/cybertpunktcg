// Règles de tournoi partagées par les commandes organisateur et joueur : lecture de l'état
// chargé, éligibilité, classement, création de rondes, drop, fin des rondes suisses, top cut.
// Toutes les écritures passent par la transaction ouverte par writeTournament.

import { fail } from "./errors";
import type { MatchContext, OneDeviceMode, Side } from "./match-state";
import { resultOf } from "./match-state";
import { pairFirstRound, pairingWarnings, pairSwissRound, type PairedMatch, type PairingPlayer, type PairingWarning } from "./pairing";
import type { Rng } from "./random";
import type { FullTournament, MatchRow, PlayerRow, RoundRow, Tx } from "./repository";
import { toMatchState } from "./repository";
import { walkoverGames, winnerOf, type MatchType, type Phase } from "./scores";
import {
  computeStandings,
  type LateEntryPolicy,
  type PlayerStatus,
  type Standing,
  type StandingsMatch,
} from "./standings";
import { cutEligible, cutSize, firstCutRound, nextCutRound, selectCut, type CutDraw, type TopCutSetting } from "./top-cut";
import { roundDurationSeconds } from "./clock";

export type TournamentStatus = "inscriptions" | "suisse" | "top_cut" | "termine" | "annule";
export type RoundStatus = "draft" | "published" | "running" | "closed";

/** Qualifiés du top cut, figés à la fin des rondes suisses (taille et têtes de série). */
export type CutState = { size: number; seeds: string[] };

export function tournamentStatus(t: FullTournament) {
  return t.status as TournamentStatus;
}

export function isReadOnly(t: FullTournament) {
  return t.status === "termine" || t.status === "annule";
}

export function organizerRole(t: FullTournament, userId: string | null | undefined) {
  if (!userId) return null;
  return (t.organizers.find((organizer) => organizer.userId === userId)?.role as "owner" | "co" | undefined) ?? null;
}

export function lastRound(t: FullTournament): RoundRow | null {
  return t.rounds.length ? t.rounds[t.rounds.length - 1] : null;
}

export function isStarted(round: Pick<RoundRow, "status">) {
  return round.status === "running" || round.status === "closed";
}

/** Rondes suisses démarrées (en cours ou clôturées). */
export function startedSwissRounds(t: FullTournament) {
  return t.rounds.filter((round) => round.phase === "swiss" && isStarted(round)).length;
}

export function findPlayer(t: FullTournament, playerId: string): PlayerRow {
  return t.players.find((player) => player.id === playerId) ?? fail("Joueur introuvable.", 404);
}

export function findMatch(t: FullTournament, matchId: string): { round: RoundRow; match: MatchRow } {
  for (const round of t.rounds) {
    const match = round.matches.find((candidate) => candidate.id === matchId);
    if (match) return { round, match };
  }
  return fail("Match introuvable.", 404);
}

export function sideOf(match: Pick<MatchRow, "playerAId" | "playerBId">, playerId: string): Side | null {
  if (match.playerAId === playerId) return "A";
  if (match.playerBId === playerId) return "B";
  return null;
}

export function matchContext(t: FullTournament, round: RoundRow, now: Date): MatchContext {
  return {
    matchType: t.matchType as MatchType,
    phase: round.phase as Phase,
    oneDeviceMode: t.oneDeviceMode as OneDeviceMode,
    now,
  };
}

/** Joueur « équipé » : lié à un compte ou à un appareil. */
export function hasApp(player: Pick<PlayerRow, "userId" | "deviceTokenHash">) {
  return player.userId !== null || player.deviceTokenHash !== null;
}

/** Joueurs pouvant être appariés à la ronde suisse `number`. */
export function eligiblePlayers(t: FullTournament, number: number) {
  return t.players.filter((player) => player.status === "active" && player.joinedRound <= number);
}

/** Première ronde à laquelle un joueur ajouté maintenant peut être apparié. */
export function nextJoinRound(t: FullTournament) {
  return startedSwissRounds(t) + 1;
}

/** Matchs des rondes démarrées : un bye d'une ronde encore en brouillon ne compte pas. */
export function standingsMatches(t: FullTournament): StandingsMatch[] {
  return t.rounds.filter(isStarted).flatMap((round) =>
    round.matches.map((match) => ({
      round: round.number,
      phase: round.phase as Phase,
      playerAId: match.playerAId,
      playerBId: match.playerBId,
      result: resultOf(toMatchState(match)),
    })),
  );
}

export function tournamentStandings(t: FullTournament): Standing[] {
  return computeStandings(
    t.players.map((player) => ({
      id: player.id,
      name: player.name,
      status: player.status as PlayerStatus,
      missedRounds: player.missedRounds,
    })),
    standingsMatches(t),
    t.lateEntryPolicy as LateEntryPolicy,
  );
}

export function readCut(t: FullTournament): CutState | null {
  if (!t.cutJson) return null;
  try {
    return JSON.parse(t.cutJson) as CutState;
  } catch {
    return null;
  }
}

export function readCutDraws(t: FullTournament): CutDraw[] {
  if (!t.cutDrawJson) return [];
  try {
    return JSON.parse(t.cutDrawJson) as CutDraw[];
  } catch {
    return [];
  }
}

/** Crée une ronde en brouillon et ses matchs ; un bye est validé d'emblée. */
export async function createRound(
  tx: Tx,
  t: FullTournament,
  number: number,
  phase: Phase,
  matches: { a: string; b: string | null; slot?: number }[],
) {
  const round = await tx.tournamentRound.create({
    data: {
      tournamentId: t.id,
      number,
      phase,
      status: "draft",
      durationSeconds: roundDurationSeconds(phase, t.roundMinutes, t.topCutExtraMinutes),
    },
  });
  const games = walkoverGames(t.matchType as MatchType);
  for (const [index, match] of matches.entries()) {
    await tx.tournamentMatch.create({
      data: {
        roundId: round.id,
        table: index + 1,
        bracketSlot: match.slot ?? null,
        playerAId: match.a,
        playerBId: match.b,
        ...(match.b === null ? { status: "valide", kind: "bye", gamesA: games, gamesB: 0 } : {}),
      },
    });
  }
  return round;
}

/** Remplace les matchs d'une ronde non démarrée (échanges manuels). */
export async function rewriteRoundMatches(tx: Tx, t: FullTournament, round: RoundRow, matches: PairedMatch[]) {
  await tx.tournamentMatch.deleteMany({ where: { roundId: round.id } });
  const games = walkoverGames(t.matchType as MatchType);
  for (const [index, match] of matches.entries()) {
    await tx.tournamentMatch.create({
      data: {
        roundId: round.id,
        table: index + 1,
        playerAId: match.a,
        playerBId: match.b,
        ...(match.b === null ? { status: "valide", kind: "bye", gamesA: games, gamesB: 0 } : {}),
      },
    });
  }
}

/** Joueurs à apparier, dans l'ordre du classement, restreints à `eligibleIds`. */
export function pairingPlayers(t: FullTournament, eligibleIds: ReadonlySet<string>): PairingPlayer[] {
  return tournamentStandings(t)
    .filter((row) => eligibleIds.has(row.playerId))
    .map((row) => ({ id: row.playerId, points: row.points, hadBye: row.hadBye, opponentIds: row.opponentIds }));
}

/** Appariement de la ronde suisse `number` (brouillon). */
export async function pairSwiss(tx: Tx, t: FullTournament, number: number, rng: Rng) {
  const eligible = eligiblePlayers(t, number);
  if (eligible.length < 2) fail("Il faut au moins 2 joueurs actifs pour apparier une ronde.");
  const ids = new Set(eligible.map((player) => player.id));
  let matches: PairedMatch[];
  let warnings: PairingWarning[] = [];
  if (number === 1) {
    matches = pairFirstRound([...ids], rng);
  } else {
    const players = pairingPlayers(t, ids);
    matches = pairSwissRound(players);
    warnings = pairingWarnings(matches, players);
  }
  const round = await createRound(tx, t, number, "swiss", matches);
  return { roundId: round.id, warnings };
}

/** Supprime une ronde non démarrée (son appariement n'est plus à jour). */
export async function deleteDraftRound(tx: Tx, round: RoundRow) {
  if (isStarted(round)) fail("La ronde a démarré : appariements figés.", 409);
  await tx.tournamentRound.delete({ where: { id: round.id } });
}

/** Ronde non démarrée en tête, s'il y en a une. */
export function pendingRound(t: FullTournament): RoundRow | null {
  const round = lastRound(t);
  return round && !isStarted(round) ? round : null;
}

function firstCutRoundRow(t: FullTournament) {
  return t.rounds.find((round) => round.phase === "top_cut") ?? null;
}

/** Le top cut peut encore être recomposé (son premier tour n'a pas démarré). */
export function cutStillOpen(t: FullTournament) {
  if (t.status !== "top_cut") return false;
  const first = firstCutRoundRow(t);
  return !first || !isStarted(first);
}

async function composeCut(tx: Tx, t: FullTournament, size: number, rng: Rng, now: Date, declined: ReadonlySet<string>) {
  const eligible = cutEligible(tournamentStandings(t), declined);
  const effective = size > 0 ? cutSize(String(size) as TopCutSetting, eligible.length) : 0;
  const { qualified, draw } = selectCut(eligible, effective, rng, now);
  return { size: effective, qualified, draw };
}

async function createFirstCutRound(tx: Tx, t: FullTournament, seeds: string[]) {
  const number = (lastRound(t)?.number ?? 0) + 1;
  const bracket = firstCutRound(seeds);
  return createRound(
    tx,
    t,
    number,
    "top_cut",
    bracket.map((match) => ({ a: match.a, b: match.b, slot: match.slot })),
  );
}

/** Fin des rondes suisses : top cut (avec tirage éventuel) ou fin du tournoi. */
export async function endSwiss(tx: Tx, t: FullTournament, rng: Rng, now: Date) {
  const declined = new Set(t.players.filter((player) => player.cutDeclined).map((player) => player.id));
  const eligibleCount = cutEligible(tournamentStandings(t), declined).length;
  const size = cutSize(t.topCutSetting as TopCutSetting, eligibleCount);
  if (size === 0) {
    await tx.tournament.update({ where: { id: t.id }, data: { status: "termine" } });
    return { status: "termine" as const };
  }
  const cut = await composeCut(tx, t, size, rng, now, declined);
  const draws = cut.draw ? [...readCutDraws(t), cut.draw] : readCutDraws(t);
  await tx.tournament.update({
    where: { id: t.id },
    data: {
      status: "top_cut",
      cutJson: JSON.stringify({ size: cut.size, seeds: cut.qualified } satisfies CutState),
      cutDrawJson: draws.length ? JSON.stringify(draws) : null,
    },
  });
  await createFirstCutRound(tx, t, cut.qualified);
  return { status: "top_cut" as const };
}

/** Recompose le top cut (qualifié qui décline, drop, DQ) tant que son premier tour n'a pas démarré. */
export async function rebuildCut(tx: Tx, t: FullTournament, rng: Rng, now: Date) {
  const current = readCut(t);
  if (!current || !cutStillOpen(t)) fail("Le top cut a déjà commencé.", 409);
  const first = firstCutRoundRow(t);
  if (first) await deleteDraftRound(tx, first);
  // Drops, DQ et déclins viennent d'être écrits dans cette transaction : `t` est périmé, on relit.
  const players = await tx.tournamentPlayer.findMany({ where: { tournamentId: t.id }, orderBy: { createdAt: "asc" } });
  const declined = new Set(players.filter((player) => player.cutDeclined).map((player) => player.id));
  const refreshed: FullTournament = { ...t, players, rounds: t.rounds.filter((round) => round !== first) };
  const cut = await composeCut(tx, refreshed, current.size, rng, now, declined);
  const draws = cut.draw ? [...readCutDraws(t), cut.draw] : readCutDraws(t);
  if (cut.size === 0) {
    await tx.tournament.update({ where: { id: t.id }, data: { status: "termine", cutJson: null } });
    return;
  }
  await tx.tournament.update({
    where: { id: t.id },
    data: {
      cutJson: JSON.stringify({ size: cut.size, seeds: cut.qualified } satisfies CutState),
      cutDrawJson: draws.length ? JSON.stringify(draws) : null,
    },
  });
  await createFirstCutRound(tx, refreshed, cut.qualified);
}

export function winnerId(match: MatchRow): string | null {
  const result = resultOf(toMatchState(match));
  if (!result) return null;
  const winner = winnerOf(result);
  if (winner === "A") return match.playerAId;
  if (winner === "B") return match.playerBId;
  return null;
}

/** Clôture d'un tour de top cut : tour suivant en brouillon, ou champion. */
export async function advanceCut(tx: Tx, t: FullTournament, round: RoundRow) {
  if (round.matches.length === 1) {
    await tx.tournament.update({ where: { id: t.id }, data: { status: "termine", championId: winnerId(round.matches[0]) } });
    return { status: "termine" as const };
  }
  const winners = new Map<number, string>();
  for (const match of round.matches) {
    const winner = winnerId(match);
    if (!winner || match.bracketSlot === null) fail("Tour incomplet.", 409);
    winners.set(match.bracketSlot, winner);
  }
  const next = nextCutRound(winners);
  await createRound(
    tx,
    t,
    round.number + 1,
    "top_cut",
    next.map((match) => ({ a: match.a, b: match.b, slot: match.slot })),
  );
  return { status: "top_cut" as const };
}

/** Drop (ou DQ) : effet à la prochaine ronde non appariée ; recompose le top cut si besoin. */
export async function dropPlayer(
  tx: Tx,
  t: FullTournament,
  player: PlayerRow,
  options: { rng: Rng; now: Date; dq?: string },
) {
  if (player.status === "dq") fail("Ce joueur est disqualifié.", 409);
  if (player.status === "pending") fail("Inscription en attente : refusez-la plutôt.", 409);
  if (player.status === "dropped" && !options.dq) fail("Ce joueur a déjà droppé.", 409);
  const cut = readCut(t);
  const inCut = cut?.seeds.includes(player.id) ?? false;
  if (t.status === "top_cut" && inCut && !cutStillOpen(t) && !options.dq) {
    fail("Le top cut a commencé : saisissez une défaite pour ce joueur.", 409);
  }
  await tx.tournamentPlayer.update({
    where: { id: player.id },
    data: {
      status: options.dq ? "dq" : "dropped",
      dqReason: options.dq ?? null,
      droppedAfterRound: player.droppedAfterRound ?? lastPlayedRound(t, player.id),
    },
  });
  if (t.status === "top_cut" && inCut && cutStillOpen(t)) await rebuildCut(tx, t, options.rng, options.now);
}

/** Dernière ronde suisse démarrée où le joueur a un match (0 s'il n'a jamais joué). */
function lastPlayedRound(t: FullTournament, playerId: string) {
  let last = 0;
  for (const round of t.rounds) {
    if (round.phase !== "swiss" || !isStarted(round)) continue;
    if (round.matches.some((match) => sideOf(match, playerId))) last = Math.max(last, round.number);
  }
  return last;
}

/** Les joueurs d'une ronde non démarrée correspondent-ils encore aux éligibles ? */
export function roundIsUpToDate(t: FullTournament, round: RoundRow) {
  if (round.phase !== "swiss") return true;
  const paired = new Set(round.matches.flatMap((match) => (match.playerBId ? [match.playerAId, match.playerBId] : [match.playerAId])));
  const eligible = eligiblePlayers(t, round.number);
  return paired.size === eligible.length && eligible.every((player) => paired.has(player.id));
}

/** Retrait avant le tournoi : supprime le joueur (et le brouillon de ronde 1 qui le contient). */
export async function removePlayerBeforeStart(tx: Tx, t: FullTournament, player: PlayerRow) {
  if (startedSwissRounds(t) > 0) fail("Le tournoi a commencé : utilisez le drop.", 409);
  const draft = pendingRound(t);
  if (draft && draft.matches.some((match) => sideOf(match, player.id))) await deleteDraftRound(tx, draft);
  await tx.tournamentPlayer.delete({ where: { id: player.id } });
}
