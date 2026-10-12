// Classement suisse : points de match puis OMW% → GW% → OGW% (plancher 33 %), recalculé
// à partir des seuls matchs validés. Cf. specs/tournaments/standings.

import { matchPoints, POINTS_WIN, winnerOf, type MatchResult, type Phase } from "./scores";

export const PERCENT_FLOOR = 0.33;
const EPSILON = 1e-9;

export type PlayerStatus = "pending" | "active" | "dropped" | "dq" | "waitlist";
export type LateEntryPolicy = "zero" | "loss";

/** `missedRounds` : rondes suisses manquées (retard, drop puis réintégration). */
export type StandingsPlayer = { id: string; name: string; status: PlayerStatus; missedRounds: number };

/** Match tel que vu par le classement (`result` nul tant qu'il n'est pas validé). */
export type StandingsMatch = {
  round: number;
  phase: Phase;
  playerAId: string;
  /** null = bye */
  playerBId: string | null;
  result: MatchResult | null;
};

export type Standing = {
  playerId: string;
  name: string;
  status: PlayerStatus;
  /** Rang (1 = premier). Des joueurs à égalité sur tous les critères partagent le même rang. */
  rank: number;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  matchesPlayed: number;
  matchWinPct: number;
  gameWinPct: number;
  omwPct: number;
  gwPct: number;
  ogwPct: number;
  opponentIds: string[];
  hadBye: boolean;
};

type Tally = {
  points: number;
  wins: number;
  losses: number;
  draws: number;
  matches: number;
  gamesWon: number;
  gamesPlayed: number;
  opponents: string[];
  hadBye: boolean;
};

function emptyTally(): Tally {
  return { points: 0, wins: 0, losses: 0, draws: 0, matches: 0, gamesWon: 0, gamesPlayed: 0, opponents: [], hadBye: false };
}

function floorPct(value: number) {
  return Math.max(PERCENT_FLOOR, value);
}

function average(values: number[]) {
  if (values.length === 0) return PERCENT_FLOOR;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Points de match, bilan et manches d'un joueur sur la phase suisse. */
function tallyPlayers(players: StandingsPlayer[], matches: StandingsMatch[], policy: LateEntryPolicy) {
  const tallies = new Map<string, Tally>();
  for (const player of players) {
    const tally = emptyTally();
    // Mode « défaite » : rondes manquées = défaites sans adversaire.
    if (policy === "loss" && player.missedRounds > 0) {
      tally.matches += player.missedRounds;
      tally.losses += player.missedRounds;
    }
    tallies.set(player.id, tally);
  }

  for (const match of matches) {
    if (match.phase !== "swiss" || !match.result) continue;
    const a = tallies.get(match.playerAId);
    if (!a) continue;
    const result = match.result;

    if (match.playerBId === null) {
      a.points += POINTS_WIN;
      a.wins += 1;
      a.matches += 1;
      a.gamesWon += result.gamesA;
      a.gamesPlayed += result.gamesA + result.gamesB;
      a.hadBye = true;
      continue;
    }

    const b = tallies.get(match.playerBId);
    if (!b) continue;
    const points = matchPoints(result);
    const winner = winnerOf(result);
    a.points += points.a;
    b.points += points.b;
    a.matches += 1;
    b.matches += 1;
    if (winner === "A") {
      a.wins += 1;
      b.losses += 1;
    } else if (winner === "B") {
      b.wins += 1;
      a.losses += 1;
    } else if (winner === "draw") {
      a.draws += 1;
      b.draws += 1;
    } else {
      a.losses += 1;
      b.losses += 1;
    }
    // ID et double défaite : aucune manche jouée.
    if (result.kind !== "id" && result.kind !== "double_loss") {
      a.gamesWon += result.gamesA;
      b.gamesWon += result.gamesB;
      a.gamesPlayed += result.gamesA + result.gamesB;
      b.gamesPlayed += result.gamesA + result.gamesB;
    }
    a.opponents.push(match.playerBId);
    b.opponents.push(match.playerAId);
  }
  return tallies;
}

/** Ordre du classement : points, OMW%, GW%, OGW% (décroissants). 0 = égalité parfaite. */
export function compareStandings(x: Standing, y: Standing) {
  for (const key of ["points", "omwPct", "gwPct", "ogwPct"] as const) {
    const diff = y[key] - x[key];
    if (Math.abs(diff) > EPSILON) return diff;
  }
  return 0;
}

export function computeStandings(
  players: StandingsPlayer[],
  matches: StandingsMatch[],
  policy: LateEntryPolicy = "zero",
): Standing[] {
  // Ni inscriptions en attente d'approbation, ni liste d'attente : ils n'ont pas de place.
  const ranked = players.filter((player) => player.status !== "pending" && player.status !== "waitlist");
  const tallies = tallyPlayers(ranked, matches, policy);

  const mwp = new Map<string, number>();
  const gwp = new Map<string, number>();
  for (const [id, tally] of tallies) {
    mwp.set(id, tally.matches > 0 ? floorPct(tally.points / (POINTS_WIN * tally.matches)) : PERCENT_FLOOR);
    gwp.set(id, tally.gamesPlayed > 0 ? floorPct(tally.gamesWon / tally.gamesPlayed) : PERCENT_FLOOR);
  }

  const rows: Standing[] = ranked.map((player) => {
    const tally = tallies.get(player.id)!;
    return {
      playerId: player.id,
      name: player.name,
      status: player.status,
      rank: 0,
      points: tally.points,
      wins: tally.wins,
      losses: tally.losses,
      draws: tally.draws,
      matchesPlayed: tally.matches,
      matchWinPct: mwp.get(player.id)!,
      gameWinPct: gwp.get(player.id)!,
      omwPct: average(tally.opponents.map((id) => mwp.get(id) ?? PERCENT_FLOOR)),
      gwPct: gwp.get(player.id)!,
      ogwPct: average(tally.opponents.map((id) => gwp.get(id) ?? PERCENT_FLOOR)),
      opponentIds: tally.opponents,
      hadBye: tally.hadBye,
    };
  });

  rows.sort((x, y) => compareStandings(x, y) || x.name.localeCompare(y.name));
  rows.forEach((row, index) => {
    row.rank = index > 0 && compareStandings(rows[index - 1], row) === 0 ? rows[index - 1].rank : index + 1;
  });
  return rows;
}

export type FinalStanding = Standing & { finalRank: number; cutRoundsReached: number; champion: boolean };

/**
 * Classement final : joueurs du top cut selon le tour atteint (champion, finaliste, …),
 * départagés à tour égal par le classement suisse, puis les autres selon le suisse.
 */
export function computeFinalStandings(
  swiss: Standing[],
  topCutMatches: StandingsMatch[],
  championId: string | null,
): FinalStanding[] {
  // Nombre de tours de top cut joués : plus il est grand, plus le joueur est allé loin.
  const reached = new Map<string, number>();
  for (const match of topCutMatches) {
    if (match.phase !== "top_cut") continue;
    for (const id of [match.playerAId, match.playerBId]) {
      if (id) reached.set(id, (reached.get(id) ?? 0) + 1);
    }
  }
  const order = (row: Standing) => [row.playerId === championId ? 1 : 0, reached.get(row.playerId) ?? 0, -row.rank];
  const sorted = [...swiss].sort((x, y) => {
    const a = order(x);
    const b = order(y);
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return b[i] - a[i];
    return 0;
  });
  return sorted.map((row, index) => ({
    ...row,
    finalRank: index + 1,
    cutRoundsReached: reached.get(row.playerId) ?? 0,
    champion: row.playerId === championId,
  }));
}
