/**
 * Tournois, routes organisateur : 401 sans compte, 403 hors organisateurs, vue adaptée au rôle
 * (brouillon invisible des joueurs, code caché au public), sondage par révision, suppression.
 * Travaille sur une COPIE de la base SQLite ; tout ce qui est créé est supprimé dans afterAll.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";
import type { TournamentView } from "../../src/lib/tournament/view";

type Prisma = typeof import("../../src/lib/prisma").prisma;
type Routes = {
  list: typeof import("../../src/app/api/tournaments/route");
  item: typeof import("../../src/app/api/tournaments/[id]/route");
  state: typeof import("../../src/app/api/tournaments/[id]/state/route");
  actions: typeof import("../../src/app/api/tournaments/[id]/actions/route");
  invite: typeof import("../../src/app/api/tournaments/invite/[token]/route");
};

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let db: Awaited<ReturnType<typeof openDatabaseCopy>> | null = null;
let prisma: Prisma;
let routes: Routes;
let sessionCookie: string;
let playerCookieName: (id: string) => string;
let hashToken: (token: string) => string;
const userIds: string[] = [];
const tournamentIds: string[] = [];
let owner: { id: string; token: string };
let co: { id: string; token: string };
let stranger: { id: string; token: string };
let counter = 0;

function request(url: string, cookies: string[], init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (cookies.length) headers.set("cookie", cookies.join("; "));
  return new Request(`http://127.0.0.1${url}`, { ...init, headers });
}

const session = (account: { token: string } | null) => (account ? [`${sessionCookie}=${encodeURIComponent(account.token)}`] : []);
const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });

async function create(account: { token: string } | null, body: unknown) {
  const response = await routes.list.POST(request("/api/tournaments", session(account), { method: "POST", body: JSON.stringify(body) }));
  const json = (await response.json()) as { tournament?: { id: string; code: string }; error?: string };
  if (json.tournament) tournamentIds.push(json.tournament.id);
  return { status: response.status, body: json };
}

async function action(account: { token: string } | null, id: string, body: Record<string, unknown>) {
  const response = await routes.actions.POST(
    request(`/api/tournaments/${id}/actions`, session(account), {
      method: "POST",
      body: JSON.stringify({ clientActionId: `route-${stamp}-${++counter}`, ...body }),
    }),
    params({ id }),
  );
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

async function state(cookies: string[], id: string, rev?: number) {
  const url = `/api/tournaments/${id}/state${rev === undefined ? "" : `?rev=${rev}`}`;
  const response = await routes.state.GET(request(url, cookies), params({ id }));
  return { status: response.status, body: (await response.json()) as TournamentView & { unchanged?: boolean } };
}

beforeAll(async () => {
  db = await openDatabaseCopy("cptcg-tournament-routes-");
  prisma = db.prisma;
  routes = {
    list: await import("../../src/app/api/tournaments/route"),
    item: await import("../../src/app/api/tournaments/[id]/route"),
    state: await import("../../src/app/api/tournaments/[id]/state/route"),
    actions: await import("../../src/app/api/tournaments/[id]/actions/route"),
    invite: await import("../../src/app/api/tournaments/invite/[token]/route"),
  };
  const auth = await import("../../src/lib/auth");
  sessionCookie = auth.SESSION_COOKIE;
  ({ playerCookieName } = await import("../../src/lib/tournament/player-auth"));
  ({ hashToken } = await import("../../src/lib/tournament/tokens"));
  const makeAccount = async (label: string) => {
    const user = await auth.registerAccount({
      email: `tournoi.routes.${label}.${stamp}@example.com`,
      password: "motdepasse-robuste",
      displayName: `Routes ${label}`,
    });
    userIds.push(user.id);
    return { id: user.id, token: (await auth.createSession(user.id)).token };
  };
  owner = await makeAccount("owner");
  co = await makeAccount("co");
  stranger = await makeAccount("stranger");
});

afterAll(async () => {
  try {
    if (prisma && tournamentIds.length) await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    if (prisma && userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  } finally {
    await db?.cleanup();
  }
});

describe("création et liste", () => {
  it("401 sans compte, 400 si réglage invalide, 201 sinon", async () => {
    assert.equal((await create(null, { name: "Sans compte" })).status, 401);
    const invalid = await create(owner, { name: "T", roundMinutes: 5 });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error, "Durée de ronde invalide (10 à 180 minutes).");
    const created = await create(owner, { name: "Soirée vendredi" });
    assert.equal(created.status, 201);
    const response = await routes.list.GET(request("/api/tournaments", session(owner)));
    const { tournaments } = (await response.json()) as { tournaments: { id: string; role: string }[] };
    assert.ok(tournaments.some((row) => row.id === created.body.tournament!.id && row.role === "owner"));
    assert.equal((await routes.list.GET(request("/api/tournaments", []))).status, 401);
  });
});

describe("commandes", () => {
  it("401 sans compte, 403 hors organisateurs, 400 commande invalide", async () => {
    const { tournament } = (await create(owner, { name: "Droits" })).body;
    assert.equal((await action(null, tournament!.id, { type: "addPlayer", name: "Neo" })).status, 401);
    assert.equal((await action(stranger, tournament!.id, { type: "addPlayer", name: "Neo" })).status, 403);
    assert.equal((await action(owner, tournament!.id, { type: "inconnu" })).status, 400);
    assert.equal((await action(owner, "inexistant", { type: "addPlayer", name: "Neo" })).status, 404);
    const ok = await action(owner, tournament!.id, { type: "addPlayer", name: "Neo" });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.ok, true);
  });

  it("refus métier : message et détails", async () => {
    const { tournament } = (await create(owner, { name: "Démarrage" })).body;
    for (const name of ["A", "B"]) await action(owner, tournament!.id, { type: "addPlayer", name });
    await action(owner, tournament!.id, { type: "pairRound" });
    const refused = await action(owner, tournament!.id, { type: "startRound" });
    assert.equal(refused.status, 409);
    assert.equal(refused.body.error, "Moins de 4 joueurs : confirmez le démarrage.");
    assert.deepEqual(refused.body.details, { needs: "fewPlayers", active: 2 });
  });
});

describe("vue selon le rôle", () => {
  it("brouillon visible du seul organisateur ; code caché au public", async () => {
    const { tournament } = (await create(owner, { name: "Vues" })).body;
    const id = tournament!.id;
    for (const name of ["A", "B", "C", "D"]) await action(owner, id, { type: "addPlayer", name });
    // Un joueur équipé d'un appareil.
    const deviceToken = `device-${stamp}-token-0001`;
    const player = await prisma.tournamentPlayer.findFirstOrThrow({ where: { tournamentId: id, name: "A" } });
    await prisma.tournamentPlayer.update({ where: { id: player.id }, data: { deviceTokenHash: hashToken(deviceToken) } });
    const playerCookies = [`${playerCookieName(id)}=${encodeURIComponent(deviceToken)}`];
    await action(owner, id, { type: "pairRound" });

    const organizerView = (await state(session(owner), id)).body;
    assert.equal(organizerView.role, "organizer");
    assert.equal(organizerView.rounds.length, 1);
    assert.equal(organizerView.tournament.code?.length, 6);

    const playerView = (await state(playerCookies, id)).body;
    assert.equal(playerView.role, "player");
    assert.equal(playerView.me?.id, player.id);
    assert.equal(playerView.rounds.length, 0, "brouillon invisible");

    const publicView = (await state([], id)).body;
    assert.equal(publicView.role, "public");
    assert.equal(publicView.tournament.code, null);
    assert.deepEqual(publicView.logs, []);

    await action(owner, id, { type: "publishRound" });
    assert.equal((await state(playerCookies, id)).body.rounds.length, 1, "publiée : visible");
    // Les déclarations ne sont visibles que des joueurs du match.
    await action(owner, id, { type: "startRound" });
  });

  it("sondage : `unchanged` tant que la révision n'a pas bougé", async () => {
    const { tournament } = (await create(owner, { name: "Sondage" })).body;
    const id = tournament!.id;
    const first = (await state(session(owner), id)).body;
    // Tournoi neuf (révision 0) sans `rev` : vue complète, pas « inchangé ».
    assert.equal(first.revision, 0);
    assert.equal(first.unchanged, undefined);
    assert.deepEqual(first.players, []);
    const same = (await state(session(owner), id, first.revision)).body;
    assert.equal(same.unchanged, true);
    assert.ok(Date.parse(same.serverNow) > 0);
    await action(owner, id, { type: "addPlayer", name: "Nouveau" });
    const changed = (await state(session(owner), id, first.revision)).body;
    assert.equal(changed.unchanged, undefined);
    assert.equal(changed.players.length, 1);
    assert.equal((await state([], "inexistant", 0)).status, 404);
  });
});

describe("organisateurs et suppression", () => {
  it("invitation acceptée par route ; seul l'owner supprime", async () => {
    const { tournament } = (await create(owner, { name: "Suppression" })).body;
    const id = tournament!.id;
    const invite = await action(owner, id, { type: "inviteOrganizer" });
    const token = (invite.body.data as { token: string }).token;
    assert.equal((await routes.invite.POST(request(`/api/tournaments/invite/${token}`, []), params({ token }))).status, 401);
    const accepted = await routes.invite.POST(request(`/api/tournaments/invite/${token}`, session(co)), params({ token }));
    assert.equal(accepted.status, 200);
    assert.equal((await state(session(co), id)).body.organizerRole, "co");

    const denied = await routes.item.DELETE(request(`/api/tournaments/${id}`, session(co), { method: "DELETE" }), params({ id }));
    assert.equal(denied.status, 403);
    const deleted = await routes.item.DELETE(request(`/api/tournaments/${id}`, session(owner), { method: "DELETE" }), params({ id }));
    assert.equal(deleted.status, 200);
    assert.equal(await prisma.tournament.findUnique({ where: { id } }), null);
  });
});
