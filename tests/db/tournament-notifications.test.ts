/**
 * Notifications push des joueurs d'un tournoi (src/lib/tournament/notifications.ts) : évènements déduits
 * des commandes organisateur (ronde publiée puis démarrée, inscription validée, fin, annulation), texte
 * localisé et envoi aux appareils des comptes avec un service push simulé.
 * Travaille sur une COPIE de la base SQLite ; tout ce qui est créé est supprimé dans afterAll.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";
import type { OrganizerCommand } from "../../src/lib/api-schemas";
import type { PushSender } from "../../src/lib/push";
import type { TournamentEvent } from "../../src/lib/tournament/notifications";

type Prisma = typeof import("../../src/lib/prisma").prisma;
type Commands = typeof import("../../src/lib/tournament/commands");
type Notifications = typeof import("../../src/lib/tournament/notifications");
type Random = typeof import("../../src/lib/tournament/random");

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let db: Awaited<ReturnType<typeof openDatabaseCopy>> | null = null;
let prisma: Prisma;
let commands: Commands;
let notifications: Notifications;
let random: Random;
const userIds: string[] = [];
const tournamentIds: string[] = [];
let owner: string;
let alice: string;
let bruno: string;
let counter = 0;

type CommandInput = OrganizerCommand extends infer C ? (C extends OrganizerCommand ? Omit<C, "clientActionId"> : never) : never;

/** Lance une commande et renvoie les évènements produits. */
async function run(tournamentId: string, command: CommandInput, clientActionId = `notif-${stamp}-${++counter}`) {
  let events: TournamentEvent[] = [];
  const result = await commands.runOrganizerCommand(tournamentId, owner, { ...command, clientActionId }, {
    rng: random.seededRng(counter),
    onEvents: (sent) => {
      events = sent;
    },
  });
  return { result, events };
}

/** Tournoi d'une ronde suisse : Alice et Bruno ont un compte, deux invités complètent la table. */
async function tournamentWithPlayers(name: string) {
  const created = await commands.createTournament(owner, { name });
  tournamentIds.push(created.id);
  await prisma.tournament.update({ where: { id: created.id }, data: { swissRounds: 1 } });
  const players: Record<string, string> = {};
  for (const player of ["Alice", "Bruno", "Invité 1", "Invité 2"]) {
    players[player] = (await run(created.id, { type: "addPlayer", name: player })).result.data!.playerId as string;
  }
  await prisma.tournamentPlayer.update({ where: { id: players.Alice }, data: { userId: alice } });
  await prisma.tournamentPlayer.update({ where: { id: players.Bruno }, data: { userId: bruno } });
  return { id: created.id, code: created.code, players };
}

beforeAll(async () => {
  db = await openDatabaseCopy("cptcg-tournament-notifications-");
  prisma = db.prisma;
  commands = await import("../../src/lib/tournament/commands");
  notifications = await import("../../src/lib/tournament/notifications");
  random = await import("../../src/lib/tournament/random");
  const makeUser = async (label: string) => {
    const user = await prisma.user.create({
      data: { email: `tournoi.notif.${label}.${stamp}@example.com`, displayName: `Notif ${label}` },
    });
    userIds.push(user.id);
    return user.id;
  };
  owner = await makeUser("owner");
  alice = await makeUser("alice");
  bruno = await makeUser("bruno");
});

afterAll(async () => {
  try {
    if (prisma && tournamentIds.length) await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    if (prisma && userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  } finally {
    await db?.cleanup();
  }
});

describe("évènements des commandes organisateur", () => {
  it("ronde : rien en brouillon, appariement à la publication, puis démarrage ; fin avec le rang", async () => {
    const t = await tournamentWithPlayers("Notif ronde");
    assert.deepEqual((await run(t.id, { type: "pairRound" })).events, []);

    const published = await run(t.id, { type: "publishRound" });
    assert.deepEqual(published.events.map((event) => event.userId).sort(), [alice, bruno].sort());
    const aliceEvent = published.events.find((event) => event.userId === alice)!;
    assert.equal(aliceEvent.kind, "round");
    if (aliceEvent.kind !== "round") return;
    assert.equal(aliceEvent.started, false);
    assert.equal(aliceEvent.number, 1);
    assert.equal(aliceEvent.code, t.code);
    const match = await prisma.tournamentMatch.findFirstOrThrow({
      where: { OR: [{ playerAId: t.players.Alice }, { playerBId: t.players.Alice }] },
    });
    const opponentId = match.playerAId === t.players.Alice ? match.playerBId : match.playerAId;
    const opponent = await prisma.tournamentPlayer.findUniqueOrThrow({ where: { id: opponentId! } });
    assert.equal(aliceEvent.table, match.table);
    assert.equal(aliceEvent.opponent, opponent.name);

    const started = await run(t.id, { type: "startRound" });
    assert.ok(started.events.length === 2 && started.events.every((event) => event.kind === "round" && event.started));
    assert.deepEqual((await run(t.id, { type: "pauseClock" })).events, []);

    const matches = await prisma.tournamentMatch.findMany({ where: { round: { tournamentId: t.id } } });
    for (const row of matches) {
      // Alice gagne son match, l'autre match va au joueur A.
      const aliceIsB = row.playerBId === t.players.Alice;
      await run(t.id, { type: "setResult", matchId: row.id, result: { kind: "normal", gamesA: aliceIsB ? 0 : 2, gamesB: aliceIsB ? 2 : 0 } });
    }
    const closed = await run(t.id, { type: "closeRound" });
    assert.equal(closed.result.data?.status, "termine");
    const ended = closed.events.find((event) => event.userId === alice);
    assert.equal(ended?.kind, "ended");
    if (ended?.kind !== "ended") return;
    assert.equal(ended.champion, false);
    assert.equal(typeof ended.rank, "number");
  });

  it("une commande renvoyée (même clientActionId) ne notifie pas une seconde fois", async () => {
    const t = await tournamentWithPlayers("Notif renvoi");
    await run(t.id, { type: "pairRound" });
    const first = await run(t.id, { type: "publishRound" }, `notif-${stamp}-replay`);
    const replay = await run(t.id, { type: "publishRound" }, `notif-${stamp}-replay`);
    assert.equal(first.events.length, 2);
    assert.equal(replay.result.replayed, true);
    assert.deepEqual(replay.events, []);
  });

  it("inscription validée, annulation ; l'organisateur qui joue n'est pas notifié de sa propre action", async () => {
    const t = await tournamentWithPlayers("Notif validation");
    const pending = await prisma.tournamentPlayer.create({
      data: { tournamentId: t.id, name: "Owner joueur", nameKey: `owner joueur ${stamp}`, status: "pending", userId: owner },
    });
    await prisma.tournamentPlayer.update({ where: { id: t.players.Bruno }, data: { status: "pending" } });

    assert.deepEqual((await run(t.id, { type: "approvePlayer", playerId: pending.id })).events, []);
    const approved = await run(t.id, { type: "approvePlayer", playerId: t.players.Bruno });
    assert.deepEqual(approved.events.map((event) => [event.userId, event.kind]), [[bruno, "approved"]]);

    const cancelled = await run(t.id, { type: "cancel" });
    assert.deepEqual(
      cancelled.events.map((event) => [event.userId, event.kind]).sort(),
      [[alice, "cancelled"], [bruno, "cancelled"]].sort(),
    );
  });
});

describe("envoi", () => {
  it("une notification par appareil, dans sa langue, vers l'écran joueur du tournoi", async () => {
    const endpoint = `https://push.example.com/notif-${stamp}`;
    await prisma.pushSubscription.create({ data: { userId: alice, endpoint, p256dh: "key", auth: "auth", locale: "en" } });
    const sent: { endpoint: string; payload: { title: string; body: string; url: string; tag: string }; ttl: number }[] = [];
    const send: PushSender = async (target, payload, delivery) => {
      sent.push({ endpoint: target.endpoint, payload: JSON.parse(payload), ttl: delivery.ttlSeconds });
    };
    const event: TournamentEvent = {
      kind: "round",
      userId: alice,
      tournamentId: "t1",
      code: "ABC234",
      tournamentName: "Friday Night",
      phase: "swiss",
      number: 2,
      started: false,
      table: 3,
      opponent: "Bruno",
    };
    const report = await notifications.notifyTournamentEvents(prisma, [event, { ...event, userId: bruno }], { send });
    assert.deepEqual(report, { users: 1, sent: 1, failed: 0, removed: 0 });
    assert.equal(sent[0].endpoint, endpoint);
    assert.deepEqual(sent[0].payload, {
      title: "Friday Night",
      body: "Round 2: table 3 against Bruno.",
      url: "/en/t/ABC234",
      tag: "tournament-t1",
    });
    assert.equal(sent[0].ttl, 2 * 60 * 60);
  });
});

describe("texte", () => {
  const base = { userId: "u", tournamentId: "t1", code: "ABC234", tournamentName: "Soirée" };

  it("bye, top cut, démarrage, fin et annulation en français", async () => {
    const body = async (event: TournamentEvent) => (await notifications.tournamentEventPayload("fr", event)).body;
    const round = { ...base, kind: "round" as const, phase: "swiss" as const, number: 1, started: false, table: null, opponent: null };
    assert.equal(await body(round), "Ronde 1 : vous avez le bye.");
    assert.equal(
      await body({ ...round, phase: "top_cut", number: 4, started: true, table: 1, opponent: "Judy" }),
      "Top cut commence : table 1 contre Judy.",
    );
    assert.equal(await body({ ...base, kind: "ended", champion: false, rank: 1 }), "Tournoi terminé : vous finissez 1er.");
    assert.equal(await body({ ...base, kind: "ended", champion: false, rank: 3 }), "Tournoi terminé : vous finissez 3e.");
    assert.equal(await body({ ...base, kind: "ended", champion: true, rank: null }), "Tournoi terminé : vous remportez le tournoi !");
    assert.equal(await body({ ...base, kind: "ended", champion: false, rank: null }), "Tournoi terminé : les résultats sont en ligne.");
    assert.equal(await body({ ...base, kind: "cancelled" }), "L’organisateur a annulé le tournoi.");
  });
});
