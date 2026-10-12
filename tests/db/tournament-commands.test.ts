/**
 * Tournois, commandes organisateur : idempotence (même clientActionId = un seul effet), conflits
 * (409), droits owner / co-organisateur / inconnu, réglages figés, pseudos, rondes et chrono.
 * Travaille sur une COPIE de la base SQLite ; tout ce qui est créé est supprimé dans afterAll.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";
import type { OrganizerCommand } from "../../src/lib/api-schemas";

type Prisma = typeof import("../../src/lib/prisma").prisma;
type Commands = typeof import("../../src/lib/tournament/commands");
type Repository = typeof import("../../src/lib/tournament/repository");
type Random = typeof import("../../src/lib/tournament/random");

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let db: Awaited<ReturnType<typeof openDatabaseCopy>> | null = null;
let prisma: Prisma;
let commands: Commands;
let repo: Repository;
let random: Random;
const userIds: string[] = [];
const tournamentIds: string[] = [];
let owner: string;
let co: string;
let stranger: string;
let actionCounter = 0;

type CommandInput = OrganizerCommand extends infer C ? (C extends OrganizerCommand ? Omit<C, "clientActionId"> : never) : never;

function run(tournamentId: string, userId: string, command: CommandInput, clientActionId = `act-${stamp}-${++actionCounter}`) {
  return commands.runOrganizerCommand(tournamentId, userId, { ...command, clientActionId } as OrganizerCommand, {
    rng: random.seededRng(actionCounter),
  });
}

async function expectError(promise: Promise<unknown>, status: number, message?: RegExp) {
  await assert.rejects(promise, (error: unknown) => {
    assert.equal((error as { status?: number }).status, status, (error as Error).message);
    if (message) assert.match((error as Error).message, message);
    return true;
  });
}

async function newTournament(name = "Commandes") {
  const created = await commands.createTournament(owner, { name });
  tournamentIds.push(created.id);
  await prisma.tournamentOrganizer.create({ data: { tournamentId: created.id, userId: co, role: "co" } });
  return created.id;
}

async function addPlayers(tournamentId: string, names: string[]) {
  const ids: string[] = [];
  for (const name of names) {
    const result = await run(tournamentId, owner, { type: "addPlayer", name });
    ids.push(result.data!.playerId as string);
  }
  return ids;
}

const load = (id: string) => repo.loadTournament(prisma, id).then((t) => t!);

beforeAll(async () => {
  db = await openDatabaseCopy("cptcg-tournament-commands-");
  prisma = db.prisma;
  commands = await import("../../src/lib/tournament/commands");
  repo = await import("../../src/lib/tournament/repository");
  random = await import("../../src/lib/tournament/random");
  const makeUser = async (label: string) => {
    const user = await prisma.user.create({
      data: { email: `tournoi.cmd.${label}.${stamp}@example.com`, displayName: `Cmd ${label}` },
    });
    userIds.push(user.id);
    return user.id;
  };
  owner = await makeUser("owner");
  co = await makeUser("co");
  stranger = await makeUser("stranger");
});

afterAll(async () => {
  try {
    if (prisma && tournamentIds.length) await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    if (prisma && userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  } finally {
    await db?.cleanup();
  }
});

describe("création", () => {
  it("code unique de 6 caractères, valeurs par défaut, créateur owner", async () => {
    const id = await newTournament("Soirée vendredi");
    const t = await load(id);
    assert.match(t.code, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    assert.equal(t.status, "inscriptions");
    assert.equal(t.format, "boutique");
    assert.equal(t.matchType, "bo3");
    assert.equal(t.roundMinutes, 50);
    assert.equal(t.topCutSetting, "aucun");
    assert.deepEqual(
      t.organizers.map((o) => [o.userId, o.role]),
      [[owner, "owner"], [co, "co"]],
    );
    const listed = await commands.listTournaments(owner);
    assert.ok(listed.some((row) => row.id === id && row.role === "owner"));
  });
});

describe("idempotence", () => {
  it("la même commande envoyée deux fois n'a qu'un effet", async () => {
    const id = await newTournament();
    const command: CommandInput = { type: "addPlayer", name: "Neo" };
    const first = await run(id, owner, command, `dup-${stamp}`);
    const second = await run(id, owner, command, `dup-${stamp}`);
    assert.equal(second.replayed, true);
    assert.deepEqual(second.data, first.data);
    assert.equal((await load(id)).players.length, 1);
  });

  it("envoyée en parallèle : un seul effet aussi", async () => {
    const id = await newTournament();
    const command: CommandInput = { type: "addPlayer", name: "Trinity" };
    const results = await Promise.all([run(id, owner, command, `par-${stamp}`), run(id, owner, command, `par-${stamp}`)]);
    assert.equal(results.filter((result) => result.replayed).length, 1);
    assert.equal((await load(id)).players.length, 1);
  });

  it("le jeton d'un QR personnel n'est pas conservé dans le journal", async () => {
    const id = await newTournament();
    const [playerId] = await addPlayers(id, ["Morpheus"]);
    const issued = await run(id, owner, { type: "issueClaim", playerId }, `claim-${stamp}`);
    assert.equal(typeof issued.data?.token, "string");
    const replay = await run(id, owner, { type: "issueClaim", playerId }, `claim-${stamp}`);
    assert.equal(replay.data?.token, undefined);
  });
});

describe("droits", () => {
  it("un non-organisateur est refusé (403)", async () => {
    const id = await newTournament();
    await expectError(run(id, stranger, { type: "addPlayer", name: "Intrus" }), 403);
    assert.equal((await load(id)).players.length, 0);
  });

  it("un co-organisateur agit comme le TO, sauf annuler, supprimer et gérer les organisateurs", async () => {
    const id = await newTournament();
    await run(id, co, { type: "addPlayer", name: "Ajouté par le co" });
    await expectError(run(id, co, { type: "cancel" }), 403);
    await expectError(run(id, co, { type: "inviteOrganizer" }), 403);
    await expectError(run(id, co, { type: "removeOrganizer", userId: owner }), 403);
    await expectError(commands.deleteTournament(id, co), 403);
    await run(id, owner, { type: "cancel" });
    assert.equal((await load(id)).status, "annule");
    await expectError(run(id, owner, { type: "addPlayer", name: "Trop tard" }), 409, /lecture seule/);
  });

  it("suppression réservée à un tournoi sans inscrit et non commencé", async () => {
    const withPlayers = await newTournament();
    const [playerId] = await addPlayers(withPlayers, ["Inscrit"]);
    await expectError(commands.deleteTournament(withPlayers, owner), 409, /inscrits/);
    await run(withPlayers, owner, { type: "removePlayer", playerId });
    await commands.deleteTournament(withPlayers, owner);
    assert.equal(await repo.loadTournament(prisma, withPlayers), null);

    const empty = await newTournament();
    await run(empty, owner, { type: "cancel" });
    await commands.deleteTournament(empty, owner);
    assert.equal(await repo.loadTournament(prisma, empty), null);
  });

  it("invitation de co-organisateur à usage unique", async () => {
    const id = await newTournament();
    const invite = await run(id, owner, { type: "inviteOrganizer" });
    const token = invite.data!.token as string;
    await commands.acceptOrganizerInvite(token, stranger);
    assert.equal((await load(id)).organizers.find((o) => o.userId === stranger)?.role, "co");
    await expectError(commands.acceptOrganizerInvite(token, stranger), 404);
    await run(id, owner, { type: "removeOrganizer", userId: stranger });
    assert.equal((await load(id)).organizers.some((o) => o.userId === stranger), false);
    await expectError(run(id, owner, { type: "removeOrganizer", userId: owner }), 409);
  });
});

describe("joueurs et réglages", () => {
  it("pseudo déjà utilisé (sans casse ni accents) : 409", async () => {
    const id = await newTournament();
    const [lucas] = await addPlayers(id, ["Lucas"]);
    await expectError(run(id, owner, { type: "addPlayer", name: "lúcas" }), 409, /Pseudo déjà utilisé/);
    const [other] = await addPlayers(id, ["Neo"]);
    await expectError(run(id, owner, { type: "renamePlayer", playerId: other, name: "LUCAS" }), 409);
    await run(id, owner, { type: "renamePlayer", playerId: lucas, name: "Lucas B" });
  });

  it("réglages figés après le démarrage, durée encore modifiable", async () => {
    const id = await newTournament();
    await addPlayers(id, ["A", "B", "C", "D"]);
    await expectError(run(id, owner, { type: "updateSettings", settings: { swissRounds: 4 } }), 409, /fixé au démarrage/);
    await run(id, owner, { type: "updateSettings", settings: { matchType: "bo1" } });
    await run(id, owner, { type: "pairRound" });
    await run(id, owner, { type: "startRound" });
    await expectError(run(id, owner, { type: "updateSettings", settings: { matchType: "bo3" } }), 409, /figé/);
    await run(id, owner, { type: "updateSettings", settings: { roundMinutes: 40, swissRounds: 4, name: "Renommé" } });
    const t = await load(id);
    assert.equal(t.roundMinutes, 40);
    assert.equal(t.swissRounds, 4);
    assert.equal(t.name, "Renommé");
    await expectError(run(id, owner, { type: "updateSettings", settings: { swissRounds: 0 } }), 409);
  });

  it("régénérer le code invalide l'ancien", async () => {
    const id = await newTournament();
    const before = (await load(id)).code;
    const { data } = await run(id, owner, { type: "regenerateCode" });
    assert.notEqual(data?.code, before);
    assert.equal(await prisma.tournament.findUnique({ where: { code: before } }), null);
  });
});

describe("démarrage et rondes", () => {
  it("1 joueur : refus ; 3 joueurs : confirmation exigée", async () => {
    const id = await newTournament();
    await addPlayers(id, ["Seul"]);
    await expectError(run(id, owner, { type: "pairRound" }), 400, /au moins 2 joueurs/);
    await addPlayers(id, ["Deux", "Trois"]);
    await run(id, owner, { type: "pairRound" });
    await expectError(run(id, owner, { type: "startRound" }), 409, /Moins de 4 joueurs/);
    await run(id, owner, { type: "startRound", confirmFewPlayers: true });
    assert.equal((await load(id)).status, "suisse");
  });

  it("inscriptions en attente : démarrage refusé sauf si le TO les ignore", async () => {
    const id = await newTournament();
    await addPlayers(id, ["A", "B", "C", "D"]);
    await prisma.tournamentPlayer.create({ data: { tournamentId: id, name: "Attente", nameKey: "attente", status: "pending" } });
    await run(id, owner, { type: "pairRound" });
    await expectError(run(id, owner, { type: "startRound" }), 409, /en attente/);
    await run(id, owner, { type: "startRound", ignorePending: true });
  });

  it("joueur ajouté après l'appariement : il faut réapparier avant de démarrer", async () => {
    const id = await newTournament();
    await addPlayers(id, ["A", "B", "C", "D"]);
    await run(id, owner, { type: "pairRound" });
    const added = await run(id, owner, { type: "addPlayer", name: "E" });
    assert.deepEqual(added.warnings, [{ type: "draft_outdated" }]);
    await expectError(run(id, owner, { type: "startRound" }), 409, /relancez l'appariement/);
    await run(id, owner, { type: "pairRound" });
    const t = await load(id);
    assert.equal(t.rounds.length, 1, "le brouillon est remplacé, pas dupliqué");
    assert.equal(t.rounds[0].matches.length, 3, "5 joueurs : 2 matchs et un bye");
    await run(id, owner, { type: "startRound" });
  });

  it("échanges manuels avant démarrage, figés après", async () => {
    const id = await newTournament();
    const [a, b, c, d] = await addPlayers(id, ["A", "B", "C", "D"]);
    await run(id, owner, { type: "pairRound" });
    const before = (await load(id)).rounds[0].matches;
    const x = before[0].playerBId!;
    const y = before[1].playerBId!;
    await run(id, owner, { type: "swapPlayers", playerA: x, playerB: y });
    const after = (await load(id)).rounds[0].matches;
    assert.equal(after[0].playerBId, y);
    assert.equal(after[1].playerBId, x);
    await run(id, owner, { type: "publishRound" });
    assert.equal((await load(id)).rounds[0].status, "published");
    await run(id, owner, { type: "startRound" });
    await expectError(run(id, owner, { type: "swapPlayers", playerA: a, playerB: c }), 409, /figés/);
    void b;
    void d;
  });

  it("chrono : pause, reprise, ajout, temps de table", async () => {
    const id = await newTournament();
    await addPlayers(id, ["A", "B", "C", "D"]);
    await run(id, owner, { type: "pairRound" });
    await run(id, owner, { type: "startRound" });
    await run(id, owner, { type: "pauseClock" });
    assert.ok((await load(id)).rounds[0].pausedAt);
    await run(id, owner, { type: "resumeClock" });
    await run(id, owner, { type: "adjustClock", seconds: 300 });
    const match = (await load(id)).rounds[0].matches[0];
    await run(id, owner, { type: "addTableTime", matchId: match.id, seconds: 240 });
    const round = (await load(id)).rounds[0];
    assert.equal(round.pausedAt, null);
    assert.equal(round.addedSeconds, 300);
    assert.equal(round.matches[0].extraSeconds, 240);
  });
});

describe("résultats", () => {
  async function runningTournament() {
    const id = await newTournament();
    await addPlayers(id, ["A", "B", "C", "D"]);
    await run(id, owner, { type: "pairRound" });
    await run(id, owner, { type: "startRound" });
    return id;
  }

  it("conflit : un autre organisateur a validé un autre score entre-temps", async () => {
    const id = await runningTournament();
    const match = (await load(id)).rounds[0].matches[0];
    await run(id, co, { type: "setResult", matchId: match.id, result: { kind: "normal", gamesA: 2, gamesB: 0 }, expectedVersion: match.version });
    await expectError(
      run(id, owner, { type: "setResult", matchId: match.id, result: { kind: "normal", gamesA: 0, gamesB: 2 }, expectedVersion: match.version }),
      409,
      /validé entre-temps/,
    );
    // Même score : pas de conflit.
    await run(id, owner, { type: "setResult", matchId: match.id, result: { kind: "normal", gamesA: 2, gamesB: 0 }, expectedVersion: match.version });
    // Sans version attendue, le TO corrige librement.
    await run(id, owner, { type: "setResult", matchId: match.id, result: { kind: "normal", gamesA: 2, gamesB: 1 } });
    const logs = (await load(id)).rounds[0].matches[0].logs.map((log) => log.action);
    assert.deepEqual(logs, ["organizer_set", "correct", "correct"]);
  });

  it("clôture refusée tant qu'un match n'est pas validé", async () => {
    const id = await runningTournament();
    const [m1, m2] = (await load(id)).rounds[0].matches;
    await run(id, owner, { type: "setResult", matchId: m1.id, result: { kind: "normal", gamesA: 2, gamesB: 0 } });
    await expectError(run(id, owner, { type: "closeRound" }), 409, /1 match/);
    await run(id, owner, { type: "noShow", matchId: m2.id, absentPlayerId: m2.playerBId! });
    const closed = await run(id, owner, { type: "closeRound" });
    assert.equal(closed.data?.status, "suisse");
    const noShowMatch = (await load(id)).rounds[0].matches[1];
    assert.deepEqual([noShowMatch.kind, noShowMatch.gamesA, noShowMatch.gamesB], ["no_show", 2, 0]);
  });

  it("organisateur qui joue : sa saisie n'est qu'une déclaration", async () => {
    const id = await newTournament();
    const [a, b] = await addPlayers(id, ["TO joueur", "Adversaire"]);
    await prisma.tournamentPlayer.update({ where: { id: a }, data: { userId: owner } });
    await run(id, owner, { type: "pairRound" });
    await run(id, owner, { type: "startRound", confirmFewPlayers: true });
    const match = (await load(id)).rounds[0].matches[0];
    const declared = await run(id, owner, { type: "setResult", matchId: match.id, result: { kind: "normal", gamesA: 2, gamesB: 0 } });
    assert.equal(declared.data?.status, "declare");
    // Un co-organisateur peut valider.
    const validated = await run(id, co, {
      type: "setResult",
      matchId: match.id,
      result: match.playerAId === a ? { kind: "normal", gamesA: 2, gamesB: 0 } : { kind: "normal", gamesA: 0, gamesB: 2 },
    });
    assert.equal(validated.data?.status, "valide");
    void b;
  });

  it("réintégration après une ronde manquée : rondes manquées comptées, ronde d'arrivée inchangée", async () => {
    const id = await newTournament();
    const [a] = await addPlayers(id, ["A", "B", "C", "D", "E"]);
    const playRound = async () => {
      await run(id, owner, { type: "pairRound" });
      await run(id, owner, { type: "startRound", confirmFewPlayers: true });
      const round = (await load(id)).rounds.at(-1)!;
      for (const match of round.matches) {
        if (match.status !== "valide") await run(id, owner, { type: "setResult", matchId: match.id, result: { kind: "normal", gamesA: 2, gamesB: 0 } });
      }
      await run(id, owner, { type: "closeRound" });
    };
    await playRound();
    await run(id, owner, { type: "dropPlayer", playerId: a });
    await playRound();
    await run(id, owner, { type: "undropPlayer", playerId: a });
    const player = (await load(id)).players.find((candidate) => candidate.id === a)!;
    assert.equal(player.status, "active");
    assert.equal(player.joinedRound, 1);
    assert.equal(player.missedRounds, 1);
    await run(id, owner, { type: "pairRound" });
    const round3 = (await load(id)).rounds.at(-1)!;
    assert.ok(round3.matches.some((match) => match.playerAId === a || match.playerBId === a), "réapparié dès la ronde suivante");
  });
});

