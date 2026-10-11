// Accès base des tournois. Toute écriture passe par writeTournament : une transaction qui
// commence par incrémenter `revision` à condition qu'elle n'ait pas bougé depuis la lecture
// (verrou optimiste). Les écritures concurrentes sur un même tournoi sont donc sérialisées :
// la perdante relit l'état et rejoue sa commande.

import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fail } from "./errors";
import type { MatchState, MatchStatus } from "./match-state";
import type { MatchResult } from "./scores";

export type Tx = Prisma.TransactionClient;
type Db = Tx | PrismaClient;

const fullInclude = {
  organizers: {
    orderBy: { createdAt: "asc" },
    include: { user: { select: { displayName: true, email: true } } },
  },
  players: { orderBy: { createdAt: "asc" } },
  rounds: {
    orderBy: { number: "asc" },
    include: {
      matches: {
        orderBy: { table: "asc" },
        include: { logs: { orderBy: { createdAt: "asc" } } },
      },
    },
  },
} satisfies Prisma.TournamentInclude;

export type FullTournament = Prisma.TournamentGetPayload<{ include: typeof fullInclude }>;
export type TournamentRow = FullTournament;
export type RoundRow = FullTournament["rounds"][number];
export type MatchRow = RoundRow["matches"][number];
export type PlayerRow = FullTournament["players"][number];

const MAX_ATTEMPTS = 5;

class RevisionConflict extends Error {}

export async function loadTournament(db: Db, id: string): Promise<FullTournament | null> {
  const tournament = await db.tournament.findUnique({ where: { id }, include: fullInclude });
  return tournament ? withEffectiveOwner(tournament) : null;
}

export async function loadTournamentByCode(db: Db, code: string): Promise<FullTournament | null> {
  const row = await db.tournament.findUnique({ where: { code }, select: { id: true } });
  return row ? loadTournament(db, row.id) : null;
}

/** Sans owner (compte supprimé), le co-organisateur le plus ancien le devient (en mémoire). */
function withEffectiveOwner(tournament: FullTournament): FullTournament {
  if (tournament.organizers.length === 0 || tournament.organizers.some((o) => o.role === "owner")) return tournament;
  const [first, ...rest] = tournament.organizers;
  return { ...tournament, organizers: [{ ...first, role: "owner" }, ...rest] };
}

/** Persiste la promotion faite par withEffectiveOwner. */
async function persistOwner(tx: Tx, tournament: FullTournament) {
  const owner = tournament.organizers.find((o) => o.role === "owner");
  if (!owner) return;
  await tx.tournamentOrganizer.updateMany({
    where: { tournamentId: tournament.id, userId: owner.userId, role: { not: "owner" } },
    data: { role: "owner" },
  });
}

function isRetryable(error: unknown) {
  if (error instanceof RevisionConflict) return true;
  // P2034 : conflit d'écriture ou interblocage détecté par la base.
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}

/**
 * Exécute `fn` dans une transaction, avec l'état complet du tournoi lu dans cette transaction.
 * `fn` peut être rejouée : elle ne doit avoir d'effet qu'à travers `tx`.
 */
export async function writeTournament<R>(id: string, fn: (tx: Tx, tournament: FullTournament) => Promise<R>): Promise<R> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const tournament = await loadTournament(tx, id);
          if (!tournament) fail("Tournoi introuvable.", 404);
          const { count } = await tx.tournament.updateMany({
            where: { id, revision: tournament.revision },
            data: { revision: { increment: 1 } },
          });
          if (count === 0) throw new RevisionConflict();
          await persistOwner(tx, tournament);
          return fn(tx, tournament);
        },
        { maxWait: 10_000, timeout: 20_000 },
      );
    } catch (error) {
      if (!isRetryable(error)) throw error;
      if (attempt >= MAX_ATTEMPTS) fail("Le tournoi est très sollicité, réessayez dans un instant.", 503);
    }
  }
}

/** Révision courante, pour le sondage (une seule colonne lue). */
export async function tournamentRevision(id: string) {
  const row = await prisma.tournament.findUnique({ where: { id }, select: { revision: true } });
  return row?.revision ?? null;
}

function parseResult(json: string | null): MatchResult | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as MatchResult;
  } catch {
    return null;
  }
}

export function toMatchState(match: MatchRow): MatchState {
  return {
    status: match.status as MatchStatus,
    kind: match.kind as MatchResult["kind"],
    gamesA: match.gamesA,
    gamesB: match.gamesB,
    declA: parseResult(match.declAJson),
    declB: parseResult(match.declBJson),
    declaredAt: match.declaredAt,
    confirmedOnSite: match.confirmedOnSite,
    isBye: match.playerBId === null,
  };
}

function snapshot(state: MatchState) {
  return JSON.stringify({
    status: state.status,
    kind: state.kind,
    gamesA: state.gamesA,
    gamesB: state.gamesB,
    declA: state.declA,
    declB: state.declB,
    confirmedOnSite: state.confirmedOnSite,
  });
}

export type MatchLogEntry = { action: string; actorUserId?: string | null; actorPlayerId?: string | null };

/** Enregistre le nouvel état d'un match (version +1) et son historique. */
export async function saveMatchState(tx: Tx, match: MatchRow, next: MatchState, log: MatchLogEntry) {
  const before = toMatchState(match);
  await tx.tournamentMatch.update({
    where: { id: match.id },
    data: {
      status: next.status,
      kind: next.kind,
      gamesA: next.gamesA,
      gamesB: next.gamesB,
      declAJson: next.declA ? JSON.stringify(next.declA) : null,
      declBJson: next.declB ? JSON.stringify(next.declB) : null,
      declaredAt: next.declaredAt,
      confirmedOnSite: next.confirmedOnSite,
      version: { increment: 1 },
    },
  });
  await tx.tournamentMatchLog.create({
    data: {
      matchId: match.id,
      action: log.action,
      actorUserId: log.actorUserId ?? null,
      actorPlayerId: log.actorPlayerId ?? null,
      beforeJson: snapshot(before),
      afterJson: snapshot(next),
    },
  });
}
