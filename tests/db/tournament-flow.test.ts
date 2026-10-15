/**
 * Tournois, scénario complet côté serveur : tournoi compétitif mêlant joueurs papier, invités et
 * comptes, avec doublon fusionné, retardataire, drop, contestation tranchée, correction après
 * coup, DQ, égalité parfaite au seuil du top 4 départagée par tirage, qualifié qui décline, puis
 * top cut jusqu'au champion. Tous les matchs suisses finissent 1-1 : tout le monde est à égalité
 * parfaite, le tirage au sort est donc forcément sollicité.
 * Travaille sur une COPIE de la base SQLite ; tout ce qui est créé est supprimé, et vérifié.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";
import type { OrganizerCommand } from "../../src/lib/api-schemas";
import { frenchText } from "../helpers/api-text";

type Prisma = typeof import("../../src/lib/prisma").prisma;
type Commands = typeof import("../../src/lib/tournament/commands");
type PlayerCommands = typeof import("../../src/lib/tournament/player-commands");
type Join = typeof import("../../src/lib/tournament/join");
type Repository = typeof import("../../src/lib/tournament/repository");
type View = typeof import("../../src/lib/tournament/view");
type Random = typeof import("../../src/lib/tournament/random");

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const TABLES = [
  "tournament",
  "tournamentOrganizer",
  "tournamentInvite",
  "tournamentPlayer",
  "tournamentRound",
  "tournamentMatch",
  "tournamentMatchLog",
  "tournamentAction",
] as const;

let db: Awaited<ReturnType<typeof openDatabaseCopy>> | null = null;
let prisma: Prisma;
let commands: Commands;
let playerCommands: PlayerCommands;
let join: Join;
let repo: Repository;
let view: View;
let random: Random;
let hashToken: (token: string) => string;
let countsBefore: Record<string, number> = {};
const userIds: string[] = [];
let tournamentId: string | null = null;
let counter = 0;

type CommandInput = OrganizerCommand extends infer C ? (C extends OrganizerCommand ? Omit<C, "clientActionId"> : never) : never;

async function countRows() {
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    counts[table] = await (prisma[table] as unknown as { count: () => Promise<number> }).count();
  }
  return counts;
}

beforeAll(async () => {
  db = await openDatabaseCopy("cptcg-tournament-flow-");
  prisma = db.prisma;
  commands = await import("../../src/lib/tournament/commands");
  playerCommands = await import("../../src/lib/tournament/player-commands");
  join = await import("../../src/lib/tournament/join");
  repo = await import("../../src/lib/tournament/repository");
  view = await import("../../src/lib/tournament/view");
  random = await import("../../src/lib/tournament/random");
  ({ hashToken } = await import("../../src/lib/tournament/tokens"));
  countsBefore = await countRows();
});

afterAll(async () => {
  try {
    if (prisma && tournamentId) await prisma.tournament.deleteMany({ where: { id: tournamentId } });
    if (prisma && userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  } finally {
    await db?.cleanup();
  }
});

describe("tournoi complet", () => {
  it("de l'inscription au champion", async () => {
    const makeUser = async (label: string, displayName: string) => {
      const user = await prisma.user.create({ data: { email: `tournoi.flow.${label}.${stamp}@example.com`, displayName } });
      userIds.push(user.id);
      return user.id;
    };
    const owner = await makeUser("owner", "TO");
    const accountA = await makeUser("a1", "Panam");
    const accountB = await makeUser("a2", "Judy");

    const rng = random.seededRng(2077);
    const run = (command: CommandInput) =>
      commands.runOrganizerCommand(tournamentId!, owner, { ...command, clientActionId: `flow-${stamp}-${++counter}` } as OrganizerCommand, {
        rng,
      });
    const load = async () => (await repo.loadTournament(prisma, tournamentId!))!;
    const draw11 = { kind: "normal" as const, gamesA: 1, gamesB: 1 };

    // --- Création et inscriptions -------------------------------------------------------------
    const created = await commands.createTournament(owner, { name: "Night City Showdown", format: "competitif", topCutSetting: "4" });
    tournamentId = created.id;

    const paper: Record<string, string> = {};
    for (const name of ["P1", "P2", "P3", "P4", "P5", "Lucas"]) {
      paper[name] = (await run({ type: "addPlayer", name })).data!.playerId as string;
    }
    const guests: Record<string, string> = {};
    const deviceHashes: Record<string, string> = {};
    for (const name of ["G1", "G2", "Lucas B"]) {
      const result = await join.joinTournament(tournamentId, { userId: null, deviceTokenHash: null }, name);
      guests[name] = result.playerId;
      deviceHashes[name] = hashToken(result.deviceToken!);
    }
    const a1 = (await join.joinTournament(tournamentId, { userId: accountA, deviceTokenHash: null, displayName: "Panam" }, undefined)).playerId;
    const a2 = (await join.joinTournament(tournamentId, { userId: accountB, deviceTokenHash: null, displayName: "Judy" }, undefined)).playerId;

    // Doublon : « Lucas » (papier) et « Lucas B » (invité) sont la même personne.
    await run({ type: "mergePlayers", keepId: paper.Lucas, mergeId: guests["Lucas B"] });
    let t = await load();
    assert.equal(t.players.length, 10);
    const lucas = t.players.find((player) => player.id === paper.Lucas)!;
    assert.equal(lucas.deviceTokenHash, deviceHashes["Lucas B"], "Lucas garde l'appareil de son inscription");

    // --- Ronde 1 : Panam contre Judy, contestation tranchée par le TO -----------------------------
    await run({ type: "pairRound" });
    t = await load();
    const r1 = t.rounds[0];
    const tableOf = (playerId: string) => r1.matches.find((match) => match.playerAId === playerId || match.playerBId === playerId)!;
    const opponentOf = (playerId: string) => {
      const match = tableOf(playerId);
      return match.playerAId === playerId ? match.playerBId! : match.playerAId;
    };
    if (opponentOf(a1) !== a2) await run({ type: "swapPlayers", playerA: opponentOf(a1), playerB: a2 });
    await run({ type: "publishRound" });
    await run({ type: "startRound" });
    assert.equal((await load()).status, "suisse");
    assert.equal((await load()).swissRounds, 3, "boutique par défaut : 3 rondes ; on passe en 4 plus bas");
    await run({ type: "updateSettings", settings: { swissRounds: 4 } });

    t = await load();
    const contested = t.rounds[0].matches.find((match) => [match.playerAId, match.playerBId].includes(a1))!;
    const sideOfA1 = contested.playerAId === a1 ? "A" : "B";
    const a1Wins = sideOfA1 === "A" ? { gamesA: 2, gamesB: 1 } : { gamesA: 1, gamesB: 2 };
    const a2Wins = { gamesA: a1Wins.gamesB, gamesB: a1Wins.gamesA };
    await Promise.all([
      playerCommands.runPlayerCommand(tournamentId, { userId: accountA, deviceTokenHash: null }, { type: "declare", matchId: contested.id, result: { kind: "normal", ...a1Wins } }),
      playerCommands.runPlayerCommand(tournamentId, { userId: accountB, deviceTokenHash: null }, { type: "declare", matchId: contested.id, result: { kind: "normal", ...a2Wins } }),
    ]);
    assert.equal((await prisma.tournamentMatch.findUniqueOrThrow({ where: { id: contested.id } })).status, "conteste");
    await run({ type: "setResult", matchId: contested.id, result: draw11 });

    // Retardataire : arrive pendant la ronde 1, apparié à partir de la ronde 2.
    const late = (await join.joinTournament(tournamentId, { userId: null, deviceTokenHash: null }, "Retardataire")).playerId;
    // Drop : P5 joue sa ronde 1 puis s'en va.
    await run({ type: "dropPlayer", playerId: paper.P5 });

    for (const match of (await load()).rounds[0].matches) {
      if (match.status !== "valide") await run({ type: "setResult", matchId: match.id, result: draw11 });
    }
    await expectRejects(run({ type: "pairRound" }), /pas clôturée/);
    await run({ type: "closeRound" });

    // --- Rondes 2 et 3 ---------------------------------------------------------------------------
    const playRound = async (number: number, before?: () => Promise<void>) => {
      const paired = await run({ type: "pairRound" });
      assert.deepEqual(paired.warnings, [], `ronde ${number} : pas de revanche ni de second bye`);
      await run({ type: "startRound" });
      if (before) await before();
      const round = (await load()).rounds.find((candidate) => candidate.number === number)!;
      assert.equal(round.matches.some((match) => match.playerBId === null), false, `ronde ${number} : effectif pair, pas de bye`);
      for (const match of round.matches) {
        if (match.status !== "valide") await run({ type: "setResult", matchId: match.id, result: draw11 });
      }
      await run({ type: "closeRound" });
      return round;
    };

    const round2 = await playRound(2);
    const paired2 = round2.matches.flatMap((match) => [match.playerAId, match.playerBId]);
    assert.ok(paired2.includes(late), "le retardataire joue la ronde 2");
    assert.equal(paired2.includes(paper.P5), false, "le joueur droppé n'est plus apparié");
    await playRound(3);

    // --- Ronde 4 : correction d'un résultat de ronde 2, puis DQ --------------------------------
    await playRound(4, async () => {
      const corrected = await run({ type: "setResult", matchId: round2.matches[0].id, result: { kind: "normal", gamesA: 0, gamesB: 0 } });
      assert.deepEqual(corrected.warnings, [{ type: "correction_after_pairing", matchId: round2.matches[0].id }]);
      await run({ type: "disqualify", playerId: paper.P4, reason: "Comportement antisportif" });
    });

    // --- Fin des rondes suisses : égalité parfaite au seuil, tirage au sort ------------------------
    t = await load();
    assert.equal(t.status, "top_cut");
    const snapshot = view.buildView(t, { userId: owner, deviceTokenHash: null });
    const eligible = snapshot.standings.filter((row) => row.status === "active");
    assert.equal(eligible.length, 9);
    // Le retardataire n'a joué que 3 rondes (3 points) ; les 8 autres sont à égalité parfaite.
    const tied = eligible.filter((row) => row.playerId !== late);
    assert.equal(tied.length, 8);
    assert.ok(tied.every((row) => row.rank === 1 && row.points === 4), "égalité parfaite au seuil");
    assert.equal(eligible.find((row) => row.playerId === late)?.points, 3);
    assert.equal(snapshot.tournament.cutDraws.length, 1);
    assert.deepEqual([...snapshot.tournament.cutDraws[0].tied].sort(), tied.map((row) => row.playerId).sort());
    assert.equal(snapshot.tournament.cutDraws[0].picked.length, 4);
    assert.deepEqual([...snapshot.tournament.cutSeeds].sort(), [...snapshot.tournament.cutDraws[0].picked].sort());
    assert.equal(snapshot.standings.find((row) => row.playerId === paper.P4)?.status, "dq");
    assert.equal(snapshot.standings.find((row) => row.playerId === paper.P5)?.status, "dropped");

    // Un qualifié décline : nouveau tirage, il n'est plus dans l'arbre.
    const decliner = snapshot.tournament.cutSeeds[0];
    await run({ type: "declineCut", playerId: decliner });
    t = await load();
    const rebuilt = view.buildView(t, { userId: owner, deviceTokenHash: null });
    assert.equal(rebuilt.tournament.cutSeeds.length, 4);
    assert.equal(rebuilt.tournament.cutSeeds.includes(decliner), false);
    assert.equal(rebuilt.tournament.cutDraws.length, 2);
    assert.equal(rebuilt.tournament.cutDraws[1].tied.length, 7, "nouveau tirage parmi les 7 restants à égalité");
    const cutRounds = t.rounds.filter((round) => round.phase === "top_cut");
    assert.equal(cutRounds.length, 1);
    assert.equal(cutRounds[0].matches.length, 2);

    // --- Top cut : demi-finales puis finale -------------------------------------------------------
    await run({ type: "startRound" });
    const semis = (await load()).rounds.find((round) => round.phase === "top_cut")!;
    await expectRejects(run({ type: "setResult", matchId: semis.matches[0].id, result: draw11 }), /vainqueur est requis/);
    for (const match of semis.matches) {
      await run({ type: "setResult", matchId: match.id, result: { kind: "normal", gamesA: 2, gamesB: 0 } });
    }
    await run({ type: "closeRound" });
    t = await load();
    const final = t.rounds[t.rounds.length - 1];
    assert.equal(final.phase, "top_cut");
    assert.deepEqual(
      [final.matches[0].playerAId, final.matches[0].playerBId],
      [semis.matches[0].playerAId, semis.matches[1].playerAId],
      "les vainqueurs des demi-finales se retrouvent en finale",
    );
    await run({ type: "startRound" });
    await run({ type: "setResult", matchId: final.matches[0].id, result: { kind: "normal", gamesA: 1, gamesB: 2 } });
    await run({ type: "closeRound" });

    t = await load();
    assert.equal(t.status, "termine");
    assert.equal(t.championId, final.matches[0].playerBId);
    const finished = view.buildView(t, { userId: null, deviceTokenHash: null });
    assert.equal(finished.finalStandings?.[0].playerId, t.championId);
    assert.equal(finished.finalStandings?.[0].champion, true);
    assert.equal(finished.finalStandings?.[1].playerId, final.matches[0].playerAId);
    await expectRejects(run({ type: "addPlayer", name: "Trop tard" }), /lecture seule/);

    // Correction de la finale après coup : le champion change.
    await run({ type: "setResult", matchId: final.matches[0].id, result: { kind: "normal", gamesA: 2, gamesB: 1 } });
    assert.equal((await load()).championId, final.matches[0].playerAId);

    // Historique : la contestation garde les deux déclarations.
    const logs = (await load()).rounds[0].matches.find((match) => match.id === contested.id)!.logs.map((log) => log.action);
    assert.deepEqual(logs, ["declare", "declare", "organizer_set"]);
  });

  it("ne laisse aucune ligne en base", async () => {
    await prisma.tournament.deleteMany({ where: { id: tournamentId! } });
    tournamentId = null;
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    userIds.length = 0;
    assert.deepEqual(await countRows(), countsBefore);
  });
});

async function expectRejects(promise: Promise<unknown>, message: RegExp) {
  await assert.rejects(promise, (error: unknown) => {
    assert.match(frenchText(error), message);
    return true;
  });
}
