/**
 * Tournois, inscription par code / QR : invité, compte, déjà inscrit, pseudo pris ou proche d'un
 * joueur papier, approbation, inscriptions fermées, arrivée en retard, récupération par QR
 * personnel, limite de débit. Cf. specs/tournaments/registration.
 * Travaille sur une COPIE de la base SQLite ; tout ce qui est créé est supprimé dans afterAll.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";
import type { OrganizerCommand } from "../../src/lib/api-schemas";
import type { TournamentView } from "../../src/lib/tournament/view";

type Prisma = typeof import("../../src/lib/prisma").prisma;
type Routes = {
  code: typeof import("../../src/app/api/t/[code]/route");
  join: typeof import("../../src/app/api/t/[code]/join/route");
  claim: typeof import("../../src/app/api/t/claim/route");
};
type Commands = typeof import("../../src/lib/tournament/commands");

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let db: Awaited<ReturnType<typeof openDatabaseCopy>> | null = null;
let prisma: Prisma;
let routes: Routes;
let commands: Commands;
let sessionCookie: string;
let playerCookieName: (id: string) => string;
const userIds: string[] = [];
const tournamentIds: string[] = [];
let owner: { id: string; token: string };
let fan: { id: string; token: string };
let counter = 0;
let ipCounter = 0;
const previousTrustProxy = process.env.TRUST_PROXY;

/** Chaque requête vient d'une IP différente, sauf demande contraire (test de la limite de débit). */
function request(url: string, cookies: string[], init: RequestInit = {}, ip = `10.0.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (cookies.length) headers.set("cookie", cookies.join("; "));
  headers.set("x-real-ip", ip);
  return new Request(`http://127.0.0.1${url}`, { ...init, headers });
}

const session = (account: { token: string }) => `${sessionCookie}=${encodeURIComponent(account.token)}`;

type CommandInput = OrganizerCommand extends infer C ? (C extends OrganizerCommand ? Omit<C, "clientActionId"> : never) : never;

function run(tournamentId: string, command: CommandInput) {
  return commands.runOrganizerCommand(tournamentId, owner.id, { ...command, clientActionId: `join-${stamp}-${++counter}` } as OrganizerCommand);
}

async function newTournament(settings: Record<string, unknown> = {}) {
  const created = await commands.createTournament(owner.id, { name: "Inscriptions", ...settings });
  tournamentIds.push(created.id);
  return created;
}

async function join(code: string, cookies: string[], body: unknown, ip?: string) {
  const response = await routes.join.POST(
    request(`/api/t/${code}/join`, cookies, { method: "POST", body: JSON.stringify(body) }, ip),
    { params: Promise.resolve({ code }) },
  );
  const json = (await response.json()) as { playerId?: string; existing?: boolean; status?: string; error?: string; details?: { reason?: string } };
  const setCookie = response.headers.get("set-cookie") ?? "";
  const match = setCookie.match(/(cptcg_tp_[^=]+)=([^;]+)/);
  return { status: response.status, body: json, cookie: match ? `${match[1]}=${match[2]}` : null };
}

async function view(code: string, cookies: string[], ip?: string) {
  const response = await routes.code.GET(request(`/api/t/${code}`, cookies, {}, ip), { params: Promise.resolve({ code }) });
  return { status: response.status, body: (await response.json()) as TournamentView & { error?: string } };
}

beforeAll(async () => {
  process.env.TRUST_PROXY = "1";
  db = await openDatabaseCopy("cptcg-tournament-join-");
  prisma = db.prisma;
  routes = {
    code: await import("../../src/app/api/t/[code]/route"),
    join: await import("../../src/app/api/t/[code]/join/route"),
    claim: await import("../../src/app/api/t/claim/route"),
  };
  commands = await import("../../src/lib/tournament/commands");
  ({ playerCookieName } = await import("../../src/lib/tournament/player-auth"));
  const auth = await import("../../src/lib/auth");
  sessionCookie = auth.SESSION_COOKIE;
  const makeAccount = async (label: string, displayName: string) => {
    const user = await auth.registerAccount({
      email: `tournoi.join.${label}.${stamp}@example.com`,
      password: "motdepasse-robuste",
      displayName,
    });
    userIds.push(user.id);
    return { id: user.id, token: (await auth.createSession(user.id)).token };
  };
  owner = await makeAccount("owner", "Organisateur");
  fan = await makeAccount("fan", "Johnny Silverhand");
});

afterAll(async () => {
  if (previousTrustProxy === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = previousTrustProxy;
  try {
    if (prisma && tournamentIds.length) await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    if (prisma && userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (prisma) await prisma.rateLimit.deleteMany({ where: { key: { startsWith: "tournament-" } } });
  } finally {
    await db?.cleanup();
  }
});

describe("inscription par code", () => {
  it("invité : pseudo seul, appareil lié par cookie", async () => {
    const { id, code } = await newTournament();
    const joined = await join(code.toLowerCase(), [], { name: "Neo" });
    assert.equal(joined.status, 201);
    assert.equal(joined.body.status, "active");
    assert.ok(joined.cookie?.startsWith(playerCookieName(id)));
    const seen = await view(code, [joined.cookie!]);
    assert.equal(seen.body.role, "player");
    assert.equal(seen.body.me?.name, "Neo");
    assert.equal(seen.body.me?.hasApp, true);
  });

  it("invité sans pseudo : refusé", async () => {
    const { code } = await newTournament();
    const refused = await join(code, [], {});
    assert.equal(refused.status, 400);
    assert.equal(refused.body.error, "Choisissez un pseudo.");
  });

  it("compte : pseudo prérempli avec le nom affiché ; rouvrir le QR retrouve le joueur", async () => {
    const { code } = await newTournament();
    const first = await join(code, [session(fan)], {});
    assert.equal(first.status, 201);
    const again = await join(code, [session(fan)], {});
    assert.equal(again.status, 200);
    assert.equal(again.body.existing, true);
    assert.equal(again.body.playerId, first.body.playerId);
    const seen = await view(code, [session(fan)]);
    assert.equal(seen.body.me?.name, "Johnny Silverhand");
    assert.equal(seen.body.me?.isAccount, true);
  });

  it("code inconnu ou mal formé : 404", async () => {
    assert.equal((await view("ZZZZZZ", [])).status, 404);
    assert.equal((await view("abc", [])).status, 404);
    assert.equal((await join("ZZZZZZ", [], { name: "X" })).status, 404);
  });
});

describe("pseudos", () => {
  it("pseudo pris par un joueur équipé : refusé", async () => {
    const { code } = await newTournament();
    await join(code, [], { name: "Neo" });
    const refused = await join(code, [], { name: "NEO" });
    assert.equal(refused.status, 409);
    assert.equal(refused.body.error, "Pseudo déjà utilisé dans ce tournoi.");
  });

  it("pseudo proche d'un joueur papier : demander le QR personnel au TO", async () => {
    const { id, code } = await newTournament();
    await run(id, { type: "addPlayer", name: "Lucas" });
    const refused = await join(code, [], { name: "  lúcas " });
    assert.equal(refused.status, 409);
    assert.equal(refused.body.details?.reason, "paper_player");
    assert.match(refused.body.error!, /QR personnel/);
  });
});

describe("contrôle des inscriptions", () => {
  it("approbation : en attente, jamais appariée si refusée", async () => {
    const { id, code } = await newTournament({ requireApproval: true });
    const pending = await join(code, [], { name: "À distance" });
    assert.equal(pending.body.status, "pending");
    const seen = await view(code, [pending.cookie!]);
    assert.equal(seen.body.me?.status, "pending");
    for (const name of ["A", "B"]) await run(id, { type: "addPlayer", name });
    await run(id, { type: "pairRound" });
    const round = await prisma.tournamentRound.findFirstOrThrow({ where: { tournamentId: id }, include: { matches: true } });
    const paired = round.matches.flatMap((match) => [match.playerAId, match.playerBId]);
    assert.equal(paired.includes(pending.body.playerId!), false);
    await run(id, { type: "rejectPlayer", playerId: pending.body.playerId! });
    assert.equal(await prisma.tournamentPlayer.findUnique({ where: { id: pending.body.playerId! } }), null);
  });

  it("inscriptions fermées : refus, mais les inscrits accèdent toujours au tournoi", async () => {
    const { id, code } = await newTournament();
    const inside = await join(code, [], { name: "Déjà là" });
    await run(id, { type: "setRegistration", open: false });
    const refused = await join(code, [], { name: "Trop tard" });
    assert.equal(refused.status, 403);
    assert.equal((await view(code, [inside.cookie!])).body.me?.name, "Déjà là");
  });

  it("arrivée en retard : appariée à partir de la prochaine ronde, sans match fictif", async () => {
    const { id, code } = await newTournament();
    for (const name of ["A", "B", "C", "D"]) await run(id, { type: "addPlayer", name });
    await run(id, { type: "pairRound" });
    await run(id, { type: "startRound" });
    const late = await join(code, [], { name: "Retardataire" });
    assert.equal(late.status, 201);
    const player = await prisma.tournamentPlayer.findUniqueOrThrow({ where: { id: late.body.playerId! } });
    assert.equal(player.joinedRound, 2);
    // Ronde 1 : ses matchs n'incluent pas le retardataire ; on la termine.
    const round1 = await prisma.tournamentRound.findFirstOrThrow({ where: { tournamentId: id, number: 1 }, include: { matches: true } });
    for (const match of round1.matches) {
      await run(id, { type: "setResult", matchId: match.id, result: { kind: "normal", gamesA: 2, gamesB: 0 } });
    }
    await run(id, { type: "closeRound" });
    await run(id, { type: "pairRound" });
    const round2 = await prisma.tournamentRound.findFirstOrThrow({ where: { tournamentId: id, number: 2 }, include: { matches: true } });
    assert.ok(round2.matches.some((match) => match.playerAId === player.id || match.playerBId === player.id));
    const standings = (await view(code, [late.cookie!])).body.standings;
    const row = standings.find((candidate) => candidate.playerId === player.id)!;
    assert.equal(row.points, 0);
    assert.equal(row.matchesPlayed, 0);
  });

  it("tournoi terminé : inscriptions terminées", async () => {
    const { id, code } = await newTournament();
    await run(id, { type: "cancel" });
    assert.equal((await join(code, [], { name: "X" })).status, 409);
  });
});

describe("récupération par QR personnel", () => {
  it("le joueur papier récupère son profil et son historique", async () => {
    const { id, code } = await newTournament();
    const added = await run(id, { type: "addPlayer", name: "Lucas" });
    const playerId = added.data!.playerId as string;
    const { data } = await run(id, { type: "issueClaim", playerId });
    const response = await routes.claim.POST(
      request("/api/t/claim", [], { method: "POST", body: JSON.stringify({ token: data!.token }) }),
    );
    assert.equal(response.status, 200);
    const body = (await response.json()) as { tournamentId: string; code: string; playerId: string };
    assert.deepEqual(body, { tournamentId: id, code, playerId });
    const cookie = response.headers.get("set-cookie")!.match(/(cptcg_tp_[^=]+=[^;]+)/)![1];
    assert.equal((await view(code, [cookie])).body.me?.id, playerId);

    const again = await routes.claim.POST(
      request("/api/t/claim", [], { method: "POST", body: JSON.stringify({ token: data!.token }) }),
    );
    assert.equal(again.status, 404);
  });
});

describe("limite de débit", () => {
  it("plus de 20 essais de code par minute depuis la même IP : 429", async () => {
    const ip = "192.0.2.77";
    for (let i = 0; i < 20; i += 1) assert.equal((await view("ZZZZZZ", [], ip)).status, 404);
    assert.equal((await view("ZZZZZZ", [], ip)).status, 429);
    assert.equal((await view("ZZZZZZ", [], "192.0.2.78")).status, 404, "les autres IP ne sont pas bloquées");
  });
});
