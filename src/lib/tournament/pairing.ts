// Appariements suisses (cf. specs/tournaments/pairing).
// Ronde 1 : aléatoire. Ensuite : couplage parfait de coût minimal sur le graphe complet des
// joueurs, le coût d'une paire étant, du plus au moins important : revanche, écart de points
// (au carré), écart de rang. On obtient en une passe « pas de revanche si possible, sinon le
// minimum », et un joueur seul dans son groupe descend dans le groupe immédiatement inférieur.

import { maxWeightMatching, type WeightedEdge } from "./blossom";
import { fail } from "./errors";
import { shuffle, type Rng } from "./random";

export type TournamentFormat = "boutique" | "competitif";

/** Joueur à apparier, fourni dans l'ordre du classement (le premier est le mieux classé). */
export type PairingPlayer = { id: string; points: number; hadBye: boolean; opponentIds: readonly string[] };

/** `b` nul = bye. Les tables sont numérotées dans l'ordre du tableau (bye en dernier). */
export type PairedMatch = { a: string; b: string | null };

export type PairingWarning =
  | { type: "rematch"; a: string; b: string }
  | { type: "second_bye"; playerId: string };

const REMATCH_COST = 1_000_000_000_000;
const POINTS_COST = 100_000;

/** Boutique : 3 rondes. Compétitif : ⌈log₂(joueurs)⌉, au moins 3. */
export function swissRoundCount(format: TournamentFormat, activePlayers: number) {
  if (format === "boutique") return 3;
  return Math.max(3, Math.ceil(Math.log2(Math.max(2, activePlayers))));
}

/** Bye : le moins bien classé (donc le moins de points) qui n'en a pas encore eu. */
export function chooseBye(players: readonly PairingPlayer[]): string {
  for (let i = players.length - 1; i >= 0; i -= 1) if (!players[i].hadBye) return players[i].id;
  // Tout le monde a déjà eu un bye : le moins bien classé en reçoit un second.
  return players[players.length - 1].id;
}

export function pairFirstRound(playerIds: readonly string[], rng: Rng): PairedMatch[] {
  if (playerIds.length < 2) fail("Il faut au moins 2 joueurs.");
  const order = shuffle(playerIds, rng);
  const matches: PairedMatch[] = [];
  for (let i = 0; i + 1 < order.length; i += 2) matches.push({ a: order[i], b: order[i + 1] });
  if (order.length % 2 === 1) matches.push({ a: order[order.length - 1], b: null });
  return matches;
}

function havePlayed(x: PairingPlayer, y: PairingPlayer) {
  return x.opponentIds.includes(y.id);
}

export function pairSwissRound(players: readonly PairingPlayer[]): PairedMatch[] {
  if (players.length < 2) fail("Il faut au moins 2 joueurs.");
  const byeId = players.length % 2 === 1 ? chooseBye(players) : null;
  const pool = players.filter((player) => player.id !== byeId);

  const costs: { i: number; j: number; cost: number }[] = [];
  let maxCost = 0;
  for (let i = 0; i < pool.length; i += 1) {
    for (let j = i + 1; j < pool.length; j += 1) {
      const pointsGap = pool[i].points - pool[j].points;
      const cost =
        (havePlayed(pool[i], pool[j]) ? REMATCH_COST : 0) + pointsGap * pointsGap * POINTS_COST + (j - i);
      costs.push({ i, j, cost });
      maxCost = Math.max(maxCost, cost);
    }
  }
  // Coût minimal = poids maximal : poids = (coût max + 1) − coût, toujours positif.
  const edges: WeightedEdge[] = costs.map(({ i, j, cost }) => [i, j, maxCost + 1 - cost]);
  const mate = maxWeightMatching(edges, true);

  const matches: PairedMatch[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < pool.length; i += 1) {
    if (seen.has(i)) continue;
    const j = mate[i];
    if (j === undefined || j === -1) fail("Appariement impossible.", 500);
    seen.add(i);
    seen.add(j);
    matches.push({ a: pool[i].id, b: pool[j].id });
  }
  if (byeId) matches.push({ a: byeId, b: null });
  return matches;
}

/** Revanches et seconds byes contenus dans un appariement (à signaler au TO, sans l'interdire). */
export function pairingWarnings(matches: readonly PairedMatch[], players: readonly PairingPlayer[]): PairingWarning[] {
  const byId = new Map(players.map((player) => [player.id, player]));
  const warnings: PairingWarning[] = [];
  for (const match of matches) {
    const a = byId.get(match.a);
    if (!a) continue;
    if (match.b === null) {
      if (a.hadBye) warnings.push({ type: "second_bye", playerId: a.id });
      continue;
    }
    const b = byId.get(match.b);
    if (b && havePlayed(a, b)) warnings.push({ type: "rematch", a: a.id, b: b.id });
  }
  return warnings;
}

function locate(matches: readonly PairedMatch[], playerId: string) {
  for (let index = 0; index < matches.length; index += 1) {
    if (matches[index].a === playerId) return { index, slot: "a" as const };
    if (matches[index].b === playerId) return { index, slot: "b" as const };
  }
  return fail("Joueur absent de cette ronde.", 404);
}

/**
 * Échange deux joueurs entre deux matchs (ou avec le bye : le joueur échangé prend le bye).
 * Échanger deux adversaires d'un même match ne change rien.
 */
export function swapPlayers(matches: readonly PairedMatch[], first: string, second: string): PairedMatch[] {
  if (first === second) return [...matches];
  const x = locate(matches, first);
  const y = locate(matches, second);
  const next = matches.map((match) => ({ ...match }));
  if (x.index === y.index) return next;
  next[x.index][x.slot] = second;
  next[y.index][y.slot] = first;
  return normalizeByes(next);
}

/** Donne le bye à `playerId` : il échange sa place avec le joueur qui avait le bye. */
export function moveBye(matches: readonly PairedMatch[], playerId: string): PairedMatch[] {
  const bye = matches.find((match) => match.b === null);
  if (!bye) fail("Cette ronde n'a pas de bye.");
  return swapPlayers(matches, bye.a, playerId);
}

/** Un bye reste en dernière table, avec le joueur en position A. */
function normalizeByes(matches: PairedMatch[]): PairedMatch[] {
  const regular = matches.filter((match) => match.b !== null);
  const byes = matches.filter((match) => match.b === null);
  return [...regular, ...byes];
}
