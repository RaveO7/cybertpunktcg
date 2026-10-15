/**
 * Tournois, identité du joueur : cookie d'appareil haché, reconnaissance par compte, QR personnel
 * à usage unique valable 15 minutes, remplacement de l'ancien appareil, lien au compte connecté.
 * Travaille sur une COPIE de la base SQLite ; tout ce qui est créé est supprimé dans afterAll.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";
import { frenchText } from "../helpers/api-text";

type Prisma = typeof import("../../src/lib/prisma").prisma;
type PlayerAuth = typeof import("../../src/lib/tournament/player-auth");
type Commands = typeof import("../../src/lib/tournament/commands");
type Repository = typeof import("../../src/lib/tournament/repository");

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let db: Awaited<ReturnType<typeof openDatabaseCopy>> | null = null;
let prisma: Prisma;
let auth: PlayerAuth;
let commands: Commands;
let repo: Repository;
let sessionCookie: string;
const userIds: string[] = [];
const tournamentIds: string[] = [];
let owner: { id: string; token: string };
let fan: { id: string; token: string };
let counter = 0;

async function expectError(promise: Promise<unknown>, status: number, message?: RegExp) {
  await assert.rejects(promise, (error: unknown) => {
    assert.equal((error as { status?: number }).status, status, (error as Error).message);
    if (message) assert.match(frenchText(error), message);
    return true;
  });
}

async function setup() {
  const created = await commands.createTournament(owner.id, { name: "Identité" });
  tournamentIds.push(created.id);
  const added = await commands.runOrganizerCommand(created.id, owner.id, {
    type: "addPlayer",
    name: "Lucas",
    clientActionId: `auth-${stamp}-${++counter}`,
  });
  return { tournamentId: created.id, playerId: added.data!.playerId as string };
}

async function issueClaim(tournamentId: string, playerId: string, now?: Date) {
  const result = await commands.runOrganizerCommand(
    tournamentId,
    owner.id,
    { type: "issueClaim", playerId, clientActionId: `auth-${stamp}-${++counter}` },
    { now },
  );
  return result.data!.token as string;
}

function request(cookies: string[]) {
  return new Request("http://127.0.0.1/", { headers: cookies.length ? { cookie: cookies.join("; ") } : {} });
}

beforeAll(async () => {
  db = await openDatabaseCopy("cptcg-tournament-auth-");
  prisma = db.prisma;
  auth = await import("../../src/lib/tournament/player-auth");
  commands = await import("../../src/lib/tournament/commands");
  repo = await import("../../src/lib/tournament/repository");
  const accounts = await import("../../src/lib/auth");
  sessionCookie = accounts.SESSION_COOKIE;
  const makeAccount = async (label: string) => {
    const user = await accounts.registerAccount({
      email: `tournoi.auth.${label}.${stamp}@example.com`,
      password: "motdepasse-robuste",
      displayName: `Auth ${label}`,
    });
    userIds.push(user.id);
    return { id: user.id, token: (await accounts.createSession(user.id)).token };
  };
  owner = await makeAccount("owner");
  fan = await makeAccount("fan");
});

afterAll(async () => {
  try {
    if (prisma && tournamentIds.length) await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    if (prisma && userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  } finally {
    await db?.cleanup();
  }
});

describe("QR personnel", () => {
  it("lie l'appareil au joueur, ne sert qu'une fois", async () => {
    const { tournamentId, playerId } = await setup();
    const token = await issueClaim(tournamentId, playerId);
    const claimed = await auth.claimPlayer(token, null);
    assert.equal(claimed.playerId, playerId);
    assert.equal(claimed.tournamentId, tournamentId);

    const stored = await prisma.tournamentPlayer.findUniqueOrThrow({ where: { id: playerId } });
    assert.equal(stored.claimTokenHash, null);
    assert.ok(stored.deviceTokenHash);
    assert.notEqual(stored.deviceTokenHash, claimed.deviceToken, "seule l'empreinte est stockée");

    // Le cookie posé reconnaît le joueur.
    const viewer = await auth.viewerFromRequest(
      request([`${auth.playerCookieName(tournamentId)}=${encodeURIComponent(claimed.deviceToken)}`]),
      tournamentId,
    );
    const t = await repo.loadTournament(prisma, tournamentId);
    assert.equal(auth.findViewerPlayer(t!, viewer)?.id, playerId);

    await expectError(auth.claimPlayer(token, null), 404, /déjà utilisé/);
  });

  it("expiré après 15 minutes", async () => {
    const { tournamentId, playerId } = await setup();
    const token = await issueClaim(tournamentId, playerId, new Date(Date.now() - 16 * 60_000));
    await expectError(auth.claimPlayer(token, null), 410, /expiré/);
  });

  it("téléphone perdu : le nouveau QR déconnecte l'ancien appareil", async () => {
    const { tournamentId, playerId } = await setup();
    const first = await auth.claimPlayer(await issueClaim(tournamentId, playerId), null);
    const second = await auth.claimPlayer(await issueClaim(tournamentId, playerId), null);
    const t = await repo.loadTournament(prisma, tournamentId);
    const oldViewer = await auth.viewerFromRequest(
      request([`${auth.playerCookieName(tournamentId)}=${first.deviceToken}`]),
      tournamentId,
    );
    const newViewer = await auth.viewerFromRequest(
      request([`${auth.playerCookieName(tournamentId)}=${second.deviceToken}`]),
      tournamentId,
    );
    assert.equal(auth.findViewerPlayer(t!, oldViewer), null);
    assert.equal(auth.findViewerPlayer(t!, newViewer)?.id, playerId);
  });

  it("le compte connecté est lié au joueur, puis reconnu sur n'importe quel appareil", async () => {
    const { tournamentId, playerId } = await setup();
    await auth.claimPlayer(await issueClaim(tournamentId, playerId), fan.id);
    const viewer = await auth.viewerFromRequest(request([`${sessionCookie}=${encodeURIComponent(fan.token)}`]), tournamentId);
    assert.equal(viewer.userId, fan.id);
    assert.equal(viewer.deviceTokenHash, null);
    const t = await repo.loadTournament(prisma, tournamentId);
    assert.equal(auth.findViewerPlayer(t!, viewer)?.id, playerId);
  });

  it("compte déjà inscrit sous un autre pseudo : 409, il faut fusionner", async () => {
    const { tournamentId, playerId } = await setup();
    await prisma.tournamentPlayer.create({ data: { tournamentId, name: "Autre", nameKey: "autre", userId: fan.id } });
    await expectError(auth.claimPlayer(await issueClaim(tournamentId, playerId), fan.id), 409, /fusionner/);
  });

  it("jeton inconnu : 404", async () => {
    await expectError(auth.claimPlayer("jeton-inconnu-jeton-inconnu", null), 404);
  });
});

describe("visiteur sans rien", () => {
  it("ni compte ni appareil : aucun joueur", async () => {
    const { tournamentId } = await setup();
    const viewer = await auth.viewerFromRequest(request([]), tournamentId);
    assert.deepEqual(viewer, { userId: null, deviceTokenHash: null });
    const t = await repo.loadTournament(prisma, tournamentId);
    assert.equal(auth.findViewerPlayer(t!, viewer), null);
  });
});
