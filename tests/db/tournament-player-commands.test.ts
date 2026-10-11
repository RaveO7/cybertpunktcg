/**
 * Tournois, commandes joueur (route /api/tournaments/[id]/player) : déclaration, confirmation,
 * refus, déclarations concurrentes, confirmation sur place, contrôle d'accès, drop, désinscription.
 * Cf. specs/tournaments/match-reporting.
 * Travaille sur une COPIE de la base SQLite ; tout ce qui est créé est supprimé dans afterAll.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";
import type { OrganizerCommand } from "../../src/lib/api-schemas";
import type { TournamentView } from "../../src/lib/tournament/view";

type Prisma = typeof import("../../src/lib/prisma").prisma;
type Routes = {
  player: typeof import("../../src/app/api/tournaments/[id]/player/route");
  state: typeof import("../../src/app/api/tournaments/[id]/state/route");
};
type Commands = typeof import("../../src/lib/tournament/commands");

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let db: Awaited<ReturnType<typeof openDatabaseCopy>> | null = null;
let prisma: Prisma;
let routes: Routes;
let commands: Commands;
let playerCookieName: (id: string) => string;
let hashToken: (token: string) => string;
const userIds: string[] = [];
const tournamentIds: string[] = [];
let owner: string;
let counter = 0;

type CommandInput = OrganizerCommand extends infer C ? (C extends OrganizerCommand ? Omit<C, "clientActionId"> : never) : never;

function run(tournamentId: string, command: CommandInput) {
  return commands.runOrganizerCommand(tournamentId, owner, { ...command, clientActionId: `pc-${stamp}-${++counter}` } as OrganizerCommand);
}

type Table = {
  tournamentId: string;
  matchId: string;
  /** Cookie d'appareil de chaque joueur (null = joueur papier). */
  a: string | null;
  b: string | null;
  /** Joueur équipé d'un autre match. */
  outsider: string;
};

/**
 * 4 joueurs, ronde 1 démarrée. Les deux joueurs de la table 1 ont l'app (sauf `paperB`),
 * ainsi qu'un joueur de la table 2.
 */
async function setup(options: { paperB?: boolean; oneDeviceMode?: "direct" | "organizer"; start?: boolean } = {}): Promise<Table> {
  const created = await commands.createTournament(owner, { name: "Joueurs", oneDeviceMode: options.oneDeviceMode ?? "direct" });
  tournamentIds.push(created.id);
  for (const name of ["P1", "P2", "P3", "P4"]) await run(created.id, { type: "addPlayer", name });
  await run(created.id, { type: "pairRound" });
  if (options.start !== false) await run(created.id, { type: "startRound" });
  const round = await prisma.tournamentRound.findFirstOrThrow({ where: { tournamentId: created.id }, include: { matches: true } });
  const [first, second] = round.matches.sort((x, y) => x.table - y.table);
  const equip = async (playerId: string) => {
    const token = `device-${stamp}-${++counter}-xxxxxxxx`;
    await prisma.tournamentPlayer.update({ where: { id: playerId }, data: { deviceTokenHash: hashToken(token) } });
    return `${playerCookieName(created.id)}=${encodeURIComponent(token)}`;
  };
  return {
    tournamentId: created.id,
    matchId: first.id,
    a: await equip(first.playerAId),
    b: options.paperB ? null : await equip(first.playerBId!),
    outsider: await equip(second.playerAId),
  };
}

async function act(table: Table, cookie: string | null, body: Record<string, unknown>) {
  const headers = new Headers({ "content-type": "application/json" });
  if (cookie) headers.set("cookie", cookie);
  const response = await routes.player.POST(
    new Request(`http://127.0.0.1/api/tournaments/${table.tournamentId}/player`, { method: "POST", headers, body: JSON.stringify(body) }),
    { params: Promise.resolve({ id: table.tournamentId }) },
  );
  return { status: response.status, body: (await response.json()) as { ok?: boolean; status?: string; error?: string } };
}

async function viewAs(table: Table, cookie: string | null) {
  const response = await routes.state.GET(
    new Request(`http://127.0.0.1/api/tournaments/${table.tournamentId}/state`, { headers: cookie ? { cookie } : {} }),
    { params: Promise.resolve({ id: table.tournamentId }) },
  );
  return (await response.json()) as TournamentView;
}

const match = (table: Table) => prisma.tournamentMatch.findUniqueOrThrow({ where: { id: table.matchId } });
const declare = (matchId: string, gamesA: number, gamesB: number) => ({ type: "declare", matchId, result: { gamesA, gamesB } });

beforeAll(async () => {
  db = await openDatabaseCopy("cptcg-tournament-player-");
  prisma = db.prisma;
  routes = {
    player: await import("../../src/app/api/tournaments/[id]/player/route"),
    state: await import("../../src/app/api/tournaments/[id]/state/route"),
  };
  commands = await import("../../src/lib/tournament/commands");
  ({ playerCookieName } = await import("../../src/lib/tournament/player-auth"));
  ({ hashToken } = await import("../../src/lib/tournament/tokens"));
  const user = await prisma.user.create({ data: { email: `tournoi.player.owner.${stamp}@example.com`, displayName: "TO" } });
  userIds.push(user.id);
  owner = user.id;
});

afterAll(async () => {
  try {
    if (prisma && tournamentIds.length) await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    if (prisma && userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  } finally {
    await db?.cleanup();
  }
});

describe("les deux joueurs ont l'app", () => {
  it("déclaration puis confirmation : validé", async () => {
    const table = await setup();
    assert.equal((await act(table, table.a, declare(table.matchId, 2, 1))).body.status, "declare");
    // L'adversaire voit la déclaration, pas un joueur d'une autre table.
    assert.deepEqual((await viewAs(table, table.b)).rounds[0].matches[0].declA, { kind: "normal", gamesA: 2, gamesB: 1 });
    assert.equal((await viewAs(table, table.outsider)).rounds[0].matches[0].declA, null);
    assert.equal((await act(table, table.b, { type: "confirm", matchId: table.matchId })).body.status, "valide");
    const stored = await match(table);
    assert.deepEqual([stored.status, stored.gamesA, stored.gamesB], ["valide", 2, 1]);
  });

  it("désaccord : contesté, plus de déclaration joueur possible", async () => {
    const table = await setup();
    await act(table, table.a, declare(table.matchId, 2, 1));
    assert.equal((await act(table, table.b, { type: "refuse", matchId: table.matchId })).body.status, "conteste");
    const blocked = await act(table, table.a, declare(table.matchId, 2, 0));
    assert.equal(blocked.status, 409);
    assert.match(blocked.body.error!, /l'organisateur doit trancher/);
  });

  it("déclarations concurrentes différentes : contesté, aucune n'écrase l'autre", async () => {
    const table = await setup();
    const [first, second] = await Promise.all([
      act(table, table.a, declare(table.matchId, 2, 1)),
      act(table, table.b, declare(table.matchId, 1, 2)),
    ]);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    const stored = await match(table);
    assert.equal(stored.status, "conteste");
    assert.ok(stored.declAJson && stored.declBJson);
  });

  it("déclarations concurrentes identiques : validé", async () => {
    const table = await setup();
    await Promise.all([act(table, table.a, declare(table.matchId, 2, 0)), act(table, table.b, declare(table.matchId, 2, 0))]);
    assert.equal((await match(table)).status, "valide");
  });
});

describe("un seul joueur a l'app", () => {
  it("mode direct : la confirmation sur le même téléphone valide", async () => {
    const table = await setup({ paperB: true });
    await act(table, table.a, declare(table.matchId, 2, 0));
    assert.equal((await act(table, table.a, { type: "confirmOnSite", matchId: table.matchId })).body.status, "valide");
    assert.equal((await match(table)).confirmedOnSite, true);
  });

  it("mode organisateur : reste déclaré jusqu'à la validation du TO", async () => {
    const table = await setup({ paperB: true, oneDeviceMode: "organizer" });
    await act(table, table.a, declare(table.matchId, 2, 0));
    assert.equal((await act(table, table.a, { type: "confirmOnSite", matchId: table.matchId })).body.status, "declare");
    await run(table.tournamentId, { type: "setResult", matchId: table.matchId, result: { kind: "normal", gamesA: 2, gamesB: 0 } });
    assert.equal((await match(table)).status, "valide");
  });
});

describe("contrôle d'accès", () => {
  it("un joueur d'une autre table : 403 ; un inconnu : 403", async () => {
    const table = await setup();
    const outsider = await act(table, table.outsider, declare(table.matchId, 0, 2));
    assert.equal(outsider.status, 403);
    assert.equal(outsider.body.error, "Ce match n'est pas le vôtre.");
    assert.equal((await act(table, null, declare(table.matchId, 0, 2))).status, 403);
    assert.equal((await match(table)).status, "en_cours");
  });

  it("ronde non démarrée : 409", async () => {
    const table = await setup({ start: false });
    const refused = await act(table, table.a, declare(table.matchId, 2, 0));
    assert.equal(refused.status, 409);
    assert.equal(refused.body.error, "La ronde n'a pas démarré.");
  });

  it("score impossible : 400", async () => {
    const table = await setup();
    assert.equal((await act(table, table.a, declare(table.matchId, 3, 0))).status, 400);
  });
});

describe("drop et désinscription", () => {
  it("drop pendant la ronde : le match en cours reste à saisir", async () => {
    const table = await setup();
    assert.equal((await act(table, table.a, { type: "drop" })).status, 200);
    const view = await viewAs(table, table.a);
    assert.equal(view.me?.status, "dropped");
    assert.equal((await match(table)).status, "en_cours");
    assert.equal((await act(table, table.a, { type: "drop" })).status, 409, "déjà droppé");
  });

  it("désinscription avant la ronde 1, drop ensuite", async () => {
    const early = await setup({ start: false });
    assert.equal((await act(early, early.outsider, { type: "withdraw" })).status, 200);
    assert.equal((await viewAs(early, null)).players.length, 3);
    const late = await setup();
    const refused = await act(late, late.outsider, { type: "withdraw" });
    assert.equal(refused.status, 409);
    assert.equal(refused.body.error, "Le tournoi a commencé : utilisez le drop.");
  });
});
