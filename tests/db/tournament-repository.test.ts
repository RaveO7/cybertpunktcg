/**
 * Tournois, couche base : verrou optimiste par révision, écritures concurrentes, historique des
 * matchs, promotion d'un co-organisateur, conservation des joueurs après suppression de compte.
 * Travaille sur une COPIE de la base SQLite ; tout ce qui est créé est supprimé dans afterAll.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";
import { rejectsWith } from "../helpers/api-text";

type Prisma = typeof import("../../src/lib/prisma").prisma;
type Repository = typeof import("../../src/lib/tournament/repository");

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let db: Awaited<ReturnType<typeof openDatabaseCopy>> | null = null;
let prisma: Prisma;
let repo: Repository;
const userIds: string[] = [];
const tournamentIds: string[] = [];

async function makeUser(label: string) {
  const user = await prisma.user.create({
    data: { email: `tournoi.repo.${label}.${stamp}@example.com`, displayName: `Repo ${label}` },
  });
  userIds.push(user.id);
  return user;
}

async function makeTournament(ownerId: string, coId?: string) {
  const tournament = await prisma.tournament.create({
    data: {
      code: `R${stamp.slice(-5).toUpperCase()}${tournamentIds.length}`.slice(0, 12),
      name: "Repo",
      organizers: {
        create: [{ userId: ownerId, role: "owner" }, ...(coId ? [{ userId: coId, role: "co" }] : [])],
      },
    },
  });
  tournamentIds.push(tournament.id);
  return tournament;
}

beforeAll(async () => {
  db = await openDatabaseCopy("cptcg-tournament-repo-");
  prisma = db.prisma;
  repo = await import("../../src/lib/tournament/repository");
});

afterAll(async () => {
  try {
    if (prisma && tournamentIds.length) await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    if (prisma && userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  } finally {
    await db?.cleanup();
  }
});

describe("écritures", () => {
  it("chaque écriture incrémente la révision", async () => {
    const owner = await makeUser("rev");
    const tournament = await makeTournament(owner.id);
    await repo.writeTournament(tournament.id, async (tx) => {
      await tx.tournament.update({ where: { id: tournament.id }, data: { name: "Renommé" } });
    });
    const after = await repo.loadTournament(prisma, tournament.id);
    assert.equal(after?.revision, 1);
    assert.equal(after?.name, "Renommé");
    assert.equal(await repo.tournamentRevision(tournament.id), 1);
  });

  it("écritures concurrentes : aucune n'est perdue", async () => {
    const owner = await makeUser("concurrent");
    const tournament = await makeTournament(owner.id);
    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        repo.writeTournament(tournament.id, async (tx, current) => {
          // Lecture puis écriture dépendante : sans verrou, deux écritures se marcheraient dessus.
          await tx.tournament.update({
            where: { id: tournament.id },
            data: { swissRounds: current.swissRounds + 1 },
          });
          return index;
        }),
      ),
    );
    const after = await repo.loadTournament(prisma, tournament.id);
    assert.equal(after?.swissRounds, 3 + 5);
    assert.equal(after?.revision, 5);
  });

  it("tournoi introuvable : 404", async () => {
    await rejectsWith(repo.writeTournament("inexistant", async () => undefined), /Tournoi introuvable/);
  });

  it("enregistre l'état d'un match avec sa version et son historique", async () => {
    const owner = await makeUser("match");
    const tournament = await makeTournament(owner.id);
    const [a, b] = await Promise.all(
      ["A", "B"].map((name) =>
        prisma.tournamentPlayer.create({ data: { tournamentId: tournament.id, name, nameKey: name.toLowerCase() } }),
      ),
    );
    const round = await prisma.tournamentRound.create({
      data: { tournamentId: tournament.id, number: 1, phase: "swiss", status: "running", durationSeconds: 3000 },
    });
    await prisma.tournamentMatch.create({ data: { roundId: round.id, table: 1, playerAId: a.id, playerBId: b.id } });
    await repo.writeTournament(tournament.id, async (tx, current) => {
      const match = current.rounds[0].matches[0];
      const state = repo.toMatchState(match);
      await repo.saveMatchState(
        tx,
        match,
        { ...state, status: "declare", declA: { kind: "normal", gamesA: 2, gamesB: 1 }, declaredAt: new Date() },
        { action: "declare", actorPlayerId: a.id },
      );
    });
    const after = await repo.loadTournament(prisma, tournament.id);
    const match = after!.rounds[0].matches[0];
    assert.equal(match.version, 1);
    assert.equal(match.status, "declare");
    assert.deepEqual(repo.toMatchState(match).declA, { kind: "normal", gamesA: 2, gamesB: 1 });
    assert.equal(match.logs.length, 1);
    assert.equal(match.logs[0].action, "declare");
    assert.equal(JSON.parse(match.logs[0].beforeJson).status, "en_cours");
  });
});

describe("comptes supprimés", () => {
  it("le co-organisateur le plus ancien devient owner", async () => {
    const owner = await makeUser("owner-gone");
    const co = await makeUser("co-stays");
    const tournament = await makeTournament(owner.id, co.id);
    await prisma.user.delete({ where: { id: owner.id } });
    userIds.splice(userIds.indexOf(owner.id), 1);

    const loaded = await repo.loadTournament(prisma, tournament.id);
    assert.ok(loaded, "le tournoi survit à la suppression du compte du TO");
    assert.deepEqual(loaded.organizers.map((o) => [o.userId, o.role]), [[co.id, "owner"]]);
    await repo.writeTournament(tournament.id, async () => undefined);
    const stored = await prisma.tournamentOrganizer.findMany({ where: { tournamentId: tournament.id } });
    assert.deepEqual(stored.map((o) => o.role), ["owner"]);
  });

  it("le joueur et ses matchs restent, sous son pseudo de tournoi", async () => {
    const owner = await makeUser("owner-keep");
    const gone = await makeUser("player-gone");
    const tournament = await makeTournament(owner.id);
    const player = await prisma.tournamentPlayer.create({
      data: { tournamentId: tournament.id, userId: gone.id, name: "Neo", nameKey: "neo" },
    });
    const other = await prisma.tournamentPlayer.create({ data: { tournamentId: tournament.id, name: "Trinity", nameKey: "trinity" } });
    const round = await prisma.tournamentRound.create({
      data: { tournamentId: tournament.id, number: 1, phase: "swiss", status: "closed", durationSeconds: 3000 },
    });
    await prisma.tournamentMatch.create({
      data: { roundId: round.id, table: 1, playerAId: player.id, playerBId: other.id, status: "valide", gamesA: 2, gamesB: 0 },
    });
    await prisma.user.delete({ where: { id: gone.id } });
    userIds.splice(userIds.indexOf(gone.id), 1);

    const kept = await prisma.tournamentPlayer.findUnique({ where: { id: player.id } });
    assert.equal(kept?.userId, null);
    assert.equal(kept?.name, "Neo");
    assert.equal(await prisma.tournamentMatch.count({ where: { playerAId: player.id } }), 1);
  });

  it("supprimer le tournoi supprime tout en cascade", async () => {
    const owner = await makeUser("cascade");
    const tournament = await makeTournament(owner.id);
    const [a, b] = await Promise.all(
      ["X", "Y"].map((name) =>
        prisma.tournamentPlayer.create({ data: { tournamentId: tournament.id, name, nameKey: name.toLowerCase() } }),
      ),
    );
    const round = await prisma.tournamentRound.create({
      data: { tournamentId: tournament.id, number: 1, phase: "swiss", durationSeconds: 3000 },
    });
    await prisma.tournamentMatch.create({ data: { roundId: round.id, table: 1, playerAId: a.id, playerBId: b.id } });
    await prisma.tournament.delete({ where: { id: tournament.id } });
    tournamentIds.splice(tournamentIds.indexOf(tournament.id), 1);
    assert.equal(await prisma.tournamentPlayer.count({ where: { tournamentId: tournament.id } }), 0);
    assert.equal(await prisma.tournamentRound.count({ where: { tournamentId: tournament.id } }), 0);
    assert.equal(await prisma.tournamentMatch.count({ where: { roundId: round.id } }), 0);
  });

  it("un joueur qui a des matchs ne peut pas être supprimé directement", async () => {
    const owner = await makeUser("restrict");
    const tournament = await makeTournament(owner.id);
    const [a, b] = await Promise.all(
      ["P", "Q"].map((name) =>
        prisma.tournamentPlayer.create({ data: { tournamentId: tournament.id, name, nameKey: name.toLowerCase() } }),
      ),
    );
    const round = await prisma.tournamentRound.create({
      data: { tournamentId: tournament.id, number: 1, phase: "swiss", durationSeconds: 3000 },
    });
    await prisma.tournamentMatch.create({ data: { roundId: round.id, table: 1, playerAId: a.id, playerBId: b.id } });
    await assert.rejects(prisma.tournamentPlayer.delete({ where: { id: a.id } }));
  });
});
