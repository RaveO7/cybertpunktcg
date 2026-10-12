/**
 * Tournois publics et boutiques : publication, fiche publique, inscription sans code, fichier
 * calendrier, places et liste d'attente, annuaire et ses filtres, boutiques (profil, logo,
 * vérification par un administrateur), routes de géocodage.
 * Cf. specs/tournaments/{public-listing,capacity,discovery}, specs/shops/*, specs/locations/geocoding.
 * Travaille sur une COPIE de la base SQLite ; tout ce qui est créé est supprimé dans afterAll.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";
import type { OrganizerCommand } from "../../src/lib/api-schemas";
import type { Place } from "../../src/lib/geo/location";
import type { OwnedShop } from "../../src/lib/shops/shops";
import type { DirectoryResult } from "../../src/lib/tournament/directory";
import type { PublicTournamentDetail } from "../../src/lib/tournament/public-view";
import type { TournamentView } from "../../src/lib/tournament/view";

type Prisma = typeof import("../../src/lib/prisma").prisma;
type Commands = typeof import("../../src/lib/tournament/commands");
type PlayerCommands = typeof import("../../src/lib/tournament/player-commands");
type Join = typeof import("../../src/lib/tournament/join");

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const DAY = 24 * 60 * 60_000;

let db: Awaited<ReturnType<typeof openDatabaseCopy>> | null = null;
let prisma: Prisma;
let commands: Commands;
let playerCommands: PlayerCommands;
let joinLib: Join;
let routes: {
  publicList: typeof import("../../src/app/api/tournaments/public/route");
  facets: typeof import("../../src/app/api/tournaments/public/facets/route");
  publicOne: typeof import("../../src/app/api/tournaments/public/[id]/route");
  publicJoin: typeof import("../../src/app/api/tournaments/public/[id]/join/route");
  calendar: typeof import("../../src/app/api/tournaments/public/[id]/calendar/route");
  shops: typeof import("../../src/app/api/shops/route");
  shop: typeof import("../../src/app/api/shops/[slug]/route");
  logo: typeof import("../../src/app/api/shops/[slug]/logo/route");
  detach: typeof import("../../src/app/api/shops/[slug]/tournaments/[id]/route");
  adminList: typeof import("../../src/app/api/admin/shops/route");
  review: typeof import("../../src/app/api/admin/shops/[id]/review/route");
  suggest: typeof import("../../src/app/api/geocode/suggest/route");
  resolve: typeof import("../../src/app/api/geocode/resolve/route");
  tournament: typeof import("../../src/app/api/tournaments/[id]/route");
};
let sessionCookie: string;
const userIds: string[] = [];
const tournamentIds: string[] = [];
let owner: Account;
let manager: Account;
let other: Account;
let admin: Account;
let counter = 0;
let ipCounter = 0;
const previousTrustProxy = process.env.TRUST_PROXY;

type Account = { id: string; token: string };

const LYON: Place = { venueName: "Arasaka Games", address: "12 Rue de la République", postalCode: "69002", city: "Lyon", region: "Auvergne-Rhône-Alpes", country: "FR", lat: 45.764, lng: 4.8357 };
const VILLEURBANNE: Place = { venueName: null, address: "1 Cours Émile Zola", postalCode: "69100", city: "Villeurbanne", region: "Auvergne-Rhône-Alpes", country: "FR", lat: 45.7719, lng: 4.8902 };
const PARIS: Place = { venueName: null, address: "1 Rue de Rivoli", postalCode: "75001", city: "Paris", region: "Île-de-France", country: "FR", lat: 48.8566, lng: 2.3522 };
const BRUXELLES: Place = { venueName: null, address: "1 Rue Neuve", postalCode: "1000", city: "Bruxelles", region: "Bruxelles-Capitale", country: "BE", lat: 50.8503, lng: 4.3517 };

function request(url: string, cookies: string[], init: RequestInit = {}, ip = `10.9.${Math.floor(++ipCounter / 250)}.${ipCounter % 250}`) {
  const headers = new Headers(init.headers);
  if (typeof init.body === "string") headers.set("content-type", "application/json");
  if (cookies.length) headers.set("cookie", cookies.join("; "));
  headers.set("x-real-ip", ip);
  return new Request(`http://127.0.0.1${url}`, { ...init, headers });
}

const session = (account: Account) => `${sessionCookie}=${encodeURIComponent(account.token)}`;

type CommandInput = OrganizerCommand extends infer C ? (C extends OrganizerCommand ? Omit<C, "clientActionId"> : never) : never;

function run(tournamentId: string, command: CommandInput, by: Account = owner) {
  return commands.runOrganizerCommand(tournamentId, by.id, { ...command, clientActionId: `pub-${stamp}-${++counter}` } as OrganizerCommand);
}

async function newTournament(by: Account = owner, settings: Record<string, unknown> = {}) {
  const created = await commands.createTournament(by.id, { name: `Tournoi ${++counter}`, ...settings });
  tournamentIds.push(created.id);
  return created;
}

/** Tournoi public à venir, au lieu et à la date donnés. */
async function publicTournament(place: Place, inDays: number, settings: Record<string, unknown> = {}, by: Account = owner) {
  // Les tests publient bien plus que la limite quotidienne (testée à part).
  await prisma.rateLimit.deleteMany({ where: { key: `tournament-publish:${by.id}` } });
  const created = await newTournament(by);
  await run(created.id, { type: "updateSettings", settings: { startsAt: new Date(Date.now() + inDays * DAY), place, ...settings } }, by);
  await run(created.id, { type: "setVisibility", public: true }, by);
  return created;
}

async function json<T>(response: Response) {
  return { status: response.status, body: (await response.json()) as T & { error?: string } };
}

const params = <P>(value: P) => ({ params: Promise.resolve(value) });

async function guest(tournamentId: string, name: string) {
  return joinLib.joinTournament(tournamentId, { userId: null, deviceTokenHash: `device-${stamp}-${++counter}` }, name);
}

async function statuses(tournamentId: string) {
  const players = await prisma.tournamentPlayer.findMany({ where: { tournamentId }, orderBy: { createdAt: "asc" } });
  return Object.fromEntries(players.map((player) => [player.name, player.status]));
}

async function createShopFor(account: Account, name: string, place: Place = LYON) {
  const response = await routes.shops.POST(request("/api/shops", [session(account)], { method: "POST", body: JSON.stringify({ name, place }) }));
  return json<{ shop: OwnedShop }>(response);
}

async function review(shopId: string, body: unknown, by: Account = admin) {
  return json<{ shop: OwnedShop }>(
    await routes.review.POST(request(`/api/admin/shops/${shopId}/review`, [session(by)], { method: "POST", body: JSON.stringify(body) }), params({ id: shopId })),
  );
}

async function directory(query: string) {
  const res = await json<DirectoryResult>(await routes.publicList.GET(request(`/api/tournaments/public?${query}`, [])));
  return { ...res, ids: res.body.tournaments?.map((row) => row.id).filter((id) => tournamentIds.includes(id)) ?? [] };
}

beforeAll(async () => {
  process.env.TRUST_PROXY = "1";
  db = await openDatabaseCopy("cptcg-public-tournaments-");
  prisma = db.prisma;
  commands = await import("../../src/lib/tournament/commands");
  playerCommands = await import("../../src/lib/tournament/player-commands");
  joinLib = await import("../../src/lib/tournament/join");
  routes = {
    publicList: await import("../../src/app/api/tournaments/public/route"),
    facets: await import("../../src/app/api/tournaments/public/facets/route"),
    publicOne: await import("../../src/app/api/tournaments/public/[id]/route"),
    publicJoin: await import("../../src/app/api/tournaments/public/[id]/join/route"),
    calendar: await import("../../src/app/api/tournaments/public/[id]/calendar/route"),
    shops: await import("../../src/app/api/shops/route"),
    shop: await import("../../src/app/api/shops/[slug]/route"),
    logo: await import("../../src/app/api/shops/[slug]/logo/route"),
    detach: await import("../../src/app/api/shops/[slug]/tournaments/[id]/route"),
    adminList: await import("../../src/app/api/admin/shops/route"),
    review: await import("../../src/app/api/admin/shops/[id]/review/route"),
    suggest: await import("../../src/app/api/geocode/suggest/route"),
    resolve: await import("../../src/app/api/geocode/resolve/route"),
    tournament: await import("../../src/app/api/tournaments/[id]/route"),
  };
  const auth = await import("../../src/lib/auth");
  sessionCookie = auth.SESSION_COOKIE;
  const makeAccount = async (label: string, displayName: string): Promise<Account> => {
    const user = await auth.registerAccount({ email: `tournoi.public.${label}.${stamp}@example.com`, password: "motdepasse-robuste", displayName });
    userIds.push(user.id);
    return { id: user.id, token: (await auth.createSession(user.id)).token };
  };
  owner = await makeAccount("owner", "Rogue");
  manager = await makeAccount("manager", "Gérant");
  other = await makeAccount("other", "Panam");
  admin = await makeAccount("admin", "Admin");
  await prisma.user.update({ where: { id: admin.id }, data: { role: "admin" } });
});

afterAll(async () => {
  if (previousTrustProxy === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = previousTrustProxy;
  try {
    if (prisma && tournamentIds.length) await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    // Supprimer les comptes supprime aussi leurs boutiques (cascade).
    if (prisma && userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (prisma) {
      await prisma.rateLimit.deleteMany({
        where: { OR: [{ key: { startsWith: "tournament-" } }, { key: { startsWith: "geocode" } }] },
      });
    }
  } finally {
    await db?.cleanup();
  }
});

describe("compte et rôle", () => {
  it("un nouveau compte a le rôle utilisateur ; l'admin est refusé aux autres", async () => {
    const row = await prisma.user.findUniqueOrThrow({ where: { id: owner.id }, select: { role: true } });
    assert.equal(row.role, "user");
    const refused = await routes.adminList.GET(request("/api/admin/shops", [session(owner)]));
    assert.equal(refused.status, 403);
    const ok = await routes.adminList.GET(request("/api/admin/shops", [session(admin)]));
    assert.equal(ok.status, 200);
  });
});

describe("publication d'un tournoi", () => {
  it("un tournoi est privé à sa création et absent de l'annuaire", async () => {
    const { id } = await newTournament();
    const t = await prisma.tournament.findUniqueOrThrow({ where: { id } });
    assert.equal(t.visibility, "private");
    const missing = await json(await routes.publicOne.GET(request(`/api/tournaments/public/${id}`, []), params({ id })));
    assert.equal(missing.status, 404);
  });

  it("publier exige une date à venir et un lieu, et cite les champs manquants", async () => {
    const { id } = await newTournament();
    await assert.rejects(run(id, { type: "setVisibility", public: true }), (error: { status: number; details: { missing: string[] } }) => {
      assert.equal(error.status, 409);
      assert.deepEqual(error.details.missing, ["startsAt", "place"]);
      return true;
    });
    await run(id, { type: "updateSettings", settings: { startsAt: new Date(Date.now() + DAY) } });
    await assert.rejects(run(id, { type: "setVisibility", public: true }), (error: { details: { missing: string[] } }) => {
      assert.deepEqual(error.details.missing, ["place"]);
      return true;
    });
    await run(id, { type: "updateSettings", settings: { startsAt: new Date(Date.now() - DAY), place: LYON } });
    await assert.rejects(run(id, { type: "setVisibility", public: true }), /date de début/);
  });

  it("un co-organisateur peut publier ; un tournoi public garde sa date et son lieu", async () => {
    const { id } = await newTournament();
    await prisma.tournamentOrganizer.create({ data: { tournamentId: id, userId: other.id, role: "co" } });
    await run(id, { type: "updateSettings", settings: { startsAt: new Date(Date.now() + DAY), place: LYON } }, other);
    await run(id, { type: "setVisibility", public: true }, other);
    assert.equal((await prisma.tournament.findUniqueOrThrow({ where: { id } })).visibility, "public");
    await assert.rejects(run(id, { type: "updateSettings", settings: { place: null } }), /repassez-le en privé/);
  });

  it("au-delà de 10 publications par jour : refusé (429)", async () => {
    await prisma.rateLimit.deleteMany({ where: { key: `tournament-publish:${other.id}` } });
    const { id } = await newTournament(other);
    await run(id, { type: "updateSettings", settings: { startsAt: new Date(Date.now() + DAY), place: LYON } }, other);
    for (let i = 0; i < 10; i += 1) {
      await run(id, { type: "setVisibility", public: true }, other);
      await run(id, { type: "setVisibility", public: false }, other);
    }
    await assert.rejects(run(id, { type: "setVisibility", public: true }, other), (error: { status: number }) => error.status === 429);
    await prisma.rateLimit.deleteMany({ where: { key: `tournament-publish:${other.id}` } });
  });

  it("tournoi terminé : visibilité figée", async () => {
    const { id } = await newTournament();
    await prisma.tournament.update({ where: { id }, data: { status: "termine" } });
    await assert.rejects(run(id, { type: "setVisibility", public: true }), (error: { status: number }) => error.status === 409);
  });

  it("description trop longue refusée par la validation", async () => {
    const { organizerCommandSchema, validate } = await import("../../src/lib/api-schemas");
    const parsed = validate(organizerCommandSchema, {
      type: "updateSettings",
      clientActionId: "abcdefgh-1",
      settings: { description: "x".repeat(2500) },
    });
    assert.equal(parsed.ok, false);
  });
});

describe("fiche publique, inscription sans code, calendrier", () => {
  it("visiteur anonyme : informations sans le code ni les inscriptions en attente", async () => {
    const { id, code } = await publicTournament(LYON, 3, { requireApproval: true, entryFeeCents: 500, prizes: "Boosters", maxPlayers: 16 });
    await guest(id, "EnAttente");
    const res = await json<PublicTournamentDetail>(await routes.publicOne.GET(request(`/api/tournaments/public/${id}`, []), params({ id })));
    assert.equal(res.status, 200);
    assert.equal(res.body.city, "Lyon");
    assert.equal(res.body.entryFeeCents, 500);
    assert.equal(res.body.prizes, "Boosters");
    assert.equal(res.body.organizerName, "Rogue");
    assert.equal(res.body.seatsLeft, 15);
    assert.equal(res.body.playerCount, 0);
    const text = JSON.stringify(res.body);
    assert.ok(!text.includes(code), "le code n'apparaît pas");
    assert.ok(!text.includes("EnAttente"), "les inscriptions en attente n'apparaissent pas");
  });

  it("inscription en un clic avec un compte, en invité, puis inscriptions fermées", async () => {
    const { id, code } = await publicTournament(LYON, 2);
    const joined = await json<{ code: string; status: string }>(
      await routes.publicJoin.POST(request(`/api/tournaments/public/${id}/join`, [session(other)], { method: "POST", body: "{}" }), params({ id })),
    );
    assert.equal(joined.status, 201);
    assert.equal(joined.body.code, code, "le code permet de rejoindre la vue joueur");
    assert.equal(joined.body.status, "active");
    const player = await prisma.tournamentPlayer.findFirstOrThrow({ where: { tournamentId: id, userId: other.id } });
    assert.equal(player.name, "Panam");

    const invite = await routes.publicJoin.POST(
      request(`/api/tournaments/public/${id}/join`, [], { method: "POST", body: JSON.stringify({ name: "Invité" }) }),
      params({ id }),
    );
    assert.equal(invite.status, 201);
    assert.match(invite.headers.get("set-cookie") ?? "", /cptcg_tp_/);

    await run(id, { type: "setRegistration", open: false });
    const closed = await json(
      await routes.publicJoin.POST(request(`/api/tournaments/public/${id}/join`, [], { method: "POST", body: JSON.stringify({ name: "Tard" }) }), params({ id })),
    );
    assert.equal(closed.status, 403);
    assert.match(closed.body.error ?? "", /fermées/);
  });

  it("tournoi privé : inscription sans code impossible ; dépublication sans désinscription", async () => {
    const { id } = await publicTournament(LYON, 2);
    for (let i = 0; i < 3; i += 1) await guest(id, `Joueur ${i}`);
    await run(id, { type: "setVisibility", public: false });
    const refused = await routes.publicJoin.POST(
      request(`/api/tournaments/public/${id}/join`, [], { method: "POST", body: JSON.stringify({ name: "X" }) }),
      params({ id }),
    );
    assert.equal(refused.status, 404);
    const page = await routes.publicOne.GET(request(`/api/tournaments/public/${id}`, []), params({ id }));
    assert.equal(page.status, 404);
    assert.equal(await prisma.tournamentPlayer.count({ where: { tournamentId: id } }), 3);
    const listed = await directory("country=FR");
    assert.ok(!listed.ids.includes(id));
  });

  it("fichier calendrier : début, fin estimée, lieu, lien", async () => {
    const { id } = await publicTournament(LYON, 4, { swissRounds: 3, roundMinutes: 50 });
    const response = await routes.calendar.GET(request(`/api/tournaments/public/${id}/calendar`, []), params({ id }));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/calendar/);
    const ics = await response.text();
    assert.match(ics, /BEGIN:VEVENT/);
    assert.match(ics, /LOCATION:Arasaka Games\\, 12 Rue de la République/);
    assert.ok(ics.includes(`/tournois/publics/${id}`));
  });

  it("résultats d'un tournoi public terminé : champion et classement", async () => {
    const { id } = await publicTournament(LYON, 1);
    const a = await guest(id, "Alpha");
    await guest(id, "Bravo");
    await run(id, { type: "pairRound" });
    await run(id, { type: "startRound", confirmFewPlayers: true });
    const t = await prisma.tournament.findUniqueOrThrow({ where: { id }, include: { rounds: { include: { matches: true } } } });
    const match = t.rounds[0].matches[0];
    const aIsA = match.playerAId === a.playerId;
    await run(id, { type: "setResult", matchId: match.id, result: { kind: "normal", gamesA: aIsA ? 2 : 0, gamesB: aIsA ? 0 : 2 } });
    await run(id, { type: "updateSettings", settings: { swissRounds: 1 } });
    await run(id, { type: "closeRound" });
    const res = await json<PublicTournamentDetail>(await routes.publicOne.GET(request(`/api/tournaments/public/${id}`, []), params({ id })));
    assert.equal(res.body.status, "termine");
    assert.equal(res.body.championName, "Alpha");
    assert.deepEqual(res.body.standings?.map((row) => row.name), ["Alpha", "Bravo"]);
  });
});

describe("places et liste d'attente", () => {
  it("complet : la nouvelle inscription va en liste d'attente, puis promue au désistement", async () => {
    const { id } = await newTournament(owner, {});
    await run(id, { type: "updateSettings", settings: { maxPlayers: 2 } });
    const a = await guest(id, "A");
    await guest(id, "B");
    const c = await guest(id, "C");
    assert.equal(c.status, "waitlist");
    const pairedBefore = await run(id, { type: "pairRound" });
    const round = await prisma.tournamentRound.findUniqueOrThrow({ where: { id: pairedBefore.data!.roundId as string }, include: { matches: true } });
    assert.ok(round.matches.every((match) => match.playerAId !== c.playerId && match.playerBId !== c.playerId), "liste d'attente jamais appariée");

    await playerCommands.runPlayerCommand(id, { userId: null, deviceTokenHash: (await prisma.tournamentPlayer.findUniqueOrThrow({ where: { id: a.playerId } })).deviceTokenHash }, { type: "withdraw" });
    assert.deepEqual(await statuses(id), { B: "active", C: "active" });
  });

  it("approbation requise : les inscriptions en attente occupent une place ; la promotion garde l'approbation", async () => {
    const { id } = await newTournament(owner, { requireApproval: true });
    await run(id, { type: "updateSettings", settings: { maxPlayers: 2 } });
    await guest(id, "P1");
    await guest(id, "P2");
    const third = await guest(id, "P3");
    assert.equal(third.status, "waitlist");
    const p1 = await prisma.tournamentPlayer.findFirstOrThrow({ where: { tournamentId: id, name: "P1" } });
    await run(id, { type: "rejectPlayer", playerId: p1.id });
    assert.equal((await statuses(id)).P3, "pending");
  });

  it("hausse des places : les premiers en attente sont promus dans l'ordre", async () => {
    const { id } = await newTournament();
    await run(id, { type: "updateSettings", settings: { maxPlayers: 2 } });
    for (const name of ["A", "B", "W1", "W2", "W3"]) await guest(id, name);
    await run(id, { type: "updateSettings", settings: { maxPlayers: 4 } });
    assert.deepEqual(await statuses(id), { A: "active", B: "active", W1: "active", W2: "active", W3: "waitlist" });
    const view = (await import("../../src/lib/tournament/view")).buildView(
      (await (await import("../../src/lib/tournament/repository")).loadTournament(prisma, id))!,
      { userId: owner.id, deviceTokenHash: null },
    ) as TournamentView;
    assert.equal(view.players.find((player) => player.name === "W3")?.waitlistPosition, 1);
  });

  it("baisse des places : personne n'est désinscrit ; inscriptions terminées : personne n'est promu", async () => {
    const { id } = await newTournament();
    for (const name of ["A", "B", "C"]) await guest(id, name);
    await run(id, { type: "updateSettings", settings: { maxPlayers: 2 } });
    assert.deepEqual(await statuses(id), { A: "active", B: "active", C: "active" });
    assert.equal((await guest(id, "D")).status, "waitlist");
    await run(id, { type: "setRegistration", open: false });
    const a = await prisma.tournamentPlayer.findFirstOrThrow({ where: { tournamentId: id, name: "A" } });
    await run(id, { type: "removePlayer", playerId: a.id });
    await run(id, { type: "removePlayer", playerId: (await prisma.tournamentPlayer.findFirstOrThrow({ where: { tournamentId: id, name: "B" } })).id });
    assert.equal((await statuses(id)).D, "waitlist");
  });

  it("dépassement volontaire par le TO ; joueur papier sans tenir compte de la limite", async () => {
    const { id } = await newTournament();
    await run(id, { type: "updateSettings", settings: { maxPlayers: 2 } });
    for (const name of ["A", "B", "W1", "W2"]) await guest(id, name);
    const w2 = await prisma.tournamentPlayer.findFirstOrThrow({ where: { tournamentId: id, name: "W2" } });
    await run(id, { type: "promoteWaitlisted", playerId: w2.id });
    await run(id, { type: "addPlayer", name: "Papier" });
    assert.deepEqual(await statuses(id), { A: "active", B: "active", W1: "waitlist", W2: "active", Papier: "active" });
  });

  it("retrait de la liste d'attente, même après le début du tournoi", async () => {
    const { id } = await newTournament();
    await run(id, { type: "updateSettings", settings: { maxPlayers: 2 } });
    for (const name of ["A", "B"]) await guest(id, name);
    const w1 = await guest(id, "W1");
    await guest(id, "W2");
    await run(id, { type: "pairRound" });
    await run(id, { type: "startRound", confirmFewPlayers: true });
    const device = (await prisma.tournamentPlayer.findUniqueOrThrow({ where: { id: w1.playerId } })).deviceTokenHash;
    await playerCommands.runPlayerCommand(id, { userId: null, deviceTokenHash: device }, { type: "withdraw" });
    const players = await prisma.tournamentPlayer.findMany({ where: { tournamentId: id, status: "waitlist" } });
    assert.deepEqual(players.map((player) => player.name), ["W2"]);
  });
});

describe("boutiques", () => {
  let shop: OwnedShop;

  it("création : en attente de vérification, adresse de page unique", async () => {
    const created = await createShopFor(manager, `Arasaka Games ${stamp}`);
    assert.equal(created.status, 201);
    shop = created.body.shop;
    assert.equal(shop.status, "pending");
    assert.equal(shop.verified, false);
    assert.match(shop.slug, /^arasaka-games-/);
    const twin = await createShopFor(other, `Arasaka Games ${stamp}`);
    assert.equal(twin.status, 201);
    assert.notEqual(twin.body.shop.slug, shop.slug);
  });

  it("adresse non localisée, lien dangereux : refusés", async () => {
    const noPlace = await routes.shops.POST(
      request("/api/shops", [session(manager)], { method: "POST", body: JSON.stringify({ name: "Sans lieu", place: { address: "1 rue", city: "Lyon", country: "FR" } }) }),
    );
    assert.equal(noPlace.status, 400);
    const badLink = await routes.shop.PATCH(
      request(`/api/shops/${shop.slug}`, [session(manager)], { method: "PATCH", body: JSON.stringify({ website: "javascript:alert(1)" }) }),
      params({ slug: shop.slug }),
    );
    assert.equal(badLink.status, 400);
  });

  it("5 boutiques au maximum par gérant", async () => {
    const extra: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await createShopFor(owner, `Boutique ${i} ${stamp}`, VILLEURBANNE);
      assert.equal(res.status, 201);
      extra.push(res.body.shop.slug);
    }
    const sixth = await createShopFor(owner, `Boutique de trop ${stamp}`);
    assert.equal(sixth.status, 409, "la 6e est refusée");
    for (const slug of extra.slice(1)) {
      await routes.shop.DELETE(request(`/api/shops/${slug}`, [session(owner)], { method: "DELETE" }), params({ slug }));
    }
  });

  it("seul le gérant modifie sa boutique", async () => {
    const res = await routes.shop.PATCH(
      request(`/api/shops/${shop.slug}`, [session(other)], { method: "PATCH", body: JSON.stringify({ hours: "Mar–Sam" }) }),
      params({ slug: shop.slug }),
    );
    assert.equal(res.status, 403);
  });

  it("logo : PNG accepté et réduit, format ou poids refusés", async () => {
    const sharp = (await import("sharp")).default;
    const png = await sharp({ create: { width: 600, height: 300, channels: 3, background: "#f3e600" } }).png().toBuffer();
    const put = (bytes: Uint8Array) =>
      routes.logo.PUT(
        request(`/api/shops/${shop.slug}/logo`, [session(manager)], { method: "PUT", body: new Blob([new Uint8Array(bytes)]) }),
        params({ slug: shop.slug }),
      );
    const ok = await json<{ shop: OwnedShop }>(await put(new Uint8Array(png)));
    assert.equal(ok.status, 200);
    assert.ok(ok.body.shop.logoUrl);
    const served = await routes.logo.GET(request(`/api/shops/${shop.slug}/logo`, []), params({ slug: shop.slug }));
    const meta = await sharp(Buffer.from(await served.arrayBuffer())).metadata();
    assert.equal(meta.format, "webp");
    assert.equal(meta.width, 256);
    assert.equal(meta.height, 256);
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#000" } }).gif().toBuffer();
    assert.equal((await put(new Uint8Array(gif))).status, 415);
    assert.equal((await put(new Uint8Array(5 * 1024 * 1024))).status, 413);
  });

  it("vérification : validation, badge, modification d'adresse → nouvelle vérification", async () => {
    const pending = await json<{ shops: OwnedShop[] }>(await routes.adminList.GET(request("/api/admin/shops?status=pending", [session(admin)])));
    assert.ok(pending.body.shops.some((candidate) => candidate.id === shop.id));
    const verified = await review(shop.id, { decision: "verify" });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.shop.verified, true);
    const moved = await json<{ shop: OwnedShop }>(
      await routes.shop.PATCH(
        request(`/api/shops/${shop.slug}`, [session(manager)], { method: "PATCH", body: JSON.stringify({ place: VILLEURBANNE }) }),
        params({ slug: shop.slug }),
      ),
    );
    assert.equal(moved.body.shop.status, "pending");
    assert.equal(moved.body.shop.verified, false);
    const unchanged = await json<{ shop: OwnedShop }>(
      await routes.shop.PATCH(
        request(`/api/shops/${shop.slug}`, [session(manager)], { method: "PATCH", body: JSON.stringify({ place: LYON }) }),
        params({ slug: shop.slug }),
      ),
    );
    assert.equal(unchanged.body.shop.place.city, "Lyon");
    assert.equal((await review(shop.id, { decision: "verify" })).body.shop.status, "verified");
  });

  it("refus : motif obligatoire, nouvelle soumission par le gérant", async () => {
    const res = await createShopFor(other, `Faux Magasin ${stamp}`);
    const fake = res.body.shop;
    assert.equal((await review(fake.id, { decision: "reject" })).status, 400);
    const rejected = await review(fake.id, { decision: "reject", note: "Adresse fictive" });
    assert.equal(rejected.body.shop.status, "rejected");
    assert.equal(rejected.body.shop.reviewNote, "Adresse fictive");
    const page = await prisma.shop.findUniqueOrThrow({ where: { id: fake.id } });
    assert.equal(page.reviewedById, admin.id);
    const resubmitted = await json<{ shop: OwnedShop }>(
      await routes.shop.PATCH(
        request(`/api/shops/${fake.slug}`, [session(other)], { method: "PATCH", body: JSON.stringify({ place: PARIS, resubmit: true }) }),
        params({ slug: fake.slug }),
      ),
    );
    assert.equal(resubmitted.body.shop.status, "pending");
    await review(fake.id, { decision: "reject", note: "Toujours fictive" });
  });

  it("rattachement d'un tournoi : gérant seulement, lieu par défaut, boutique refusée exclue", async () => {
    const { id } = await newTournament(manager);
    await assert.rejects(run(id, { type: "setShop", shopId: shop.id }, owner), (error: { status: number }) => error.status === 403);
    await run(id, { type: "setShop", shopId: shop.id }, manager);
    const t = await prisma.tournament.findUniqueOrThrow({ where: { id } });
    assert.equal(t.shopId, shop.id);
    assert.equal(t.city, "Lyon", "lieu de la boutique par défaut");

    const otherShop = await prisma.shop.findFirstOrThrow({ where: { ownerId: other.id, status: "rejected" } });
    const { id: second } = await newTournament(other);
    await assert.rejects(run(second, { type: "setShop", shopId: otherShop.id }, other), /refusée/);
  });

  it("le gérant détache un tournoi ; supprimer la boutique conserve les tournois", async () => {
    const created = await createShopFor(manager, `Éphémère ${stamp}`);
    const temp = created.body.shop;
    const { id } = await newTournament(manager);
    await run(id, { type: "setShop", shopId: temp.id }, manager);
    const detached = await routes.detach.DELETE(
      request(`/api/shops/${temp.slug}/tournaments/${id}`, [session(manager)], { method: "DELETE" }),
      params({ slug: temp.slug, id }),
    );
    assert.equal(detached.status, 200);
    assert.equal((await prisma.tournament.findUniqueOrThrow({ where: { id } })).shopId, null);
    await run(id, { type: "setShop", shopId: temp.id }, manager);
    const deleted = await routes.shop.DELETE(request(`/api/shops/${temp.slug}`, [session(manager)], { method: "DELETE" }), params({ slug: temp.slug }));
    assert.equal(deleted.status, 200);
    const t = await prisma.tournament.findUniqueOrThrow({ where: { id } });
    assert.equal(t.shopId, null);
  });

  it("annuaire des boutiques : refusées exclues, vérifiées d'abord, rayon", async () => {
    const res = await json<{ shops: { id: string; verified: boolean }[] }>(
      await routes.shops.GET(request(`/api/shops?lat=${LYON.lat}&lng=${LYON.lng}&radius=10`, [])),
    );
    const ids = res.body.shops.map((row) => row.id);
    assert.ok(ids.includes(shop.id));
    const rejected = await prisma.shop.findMany({ where: { ownerId: other.id, status: "rejected" }, select: { id: true } });
    for (const row of rejected) assert.ok(!ids.includes(row.id));
    const firstUnverified = res.body.shops.findIndex((row) => !row.verified);
    const lastVerified = res.body.shops.map((row) => row.verified).lastIndexOf(true);
    assert.ok(firstUnverified === -1 || lastVerified < firstUnverified);
  });

  it("tournoi public d'une boutique refusée : listé, sans la boutique", async () => {
    const created = await createShopFor(other, `Bientôt refusée ${stamp}`, PARIS);
    const doomed = created.body.shop;
    const { id } = await newTournament(other);
    await run(id, { type: "setShop", shopId: doomed.id }, other);
    await run(id, { type: "updateSettings", settings: { startsAt: new Date(Date.now() + DAY) } }, other);
    await run(id, { type: "setVisibility", public: true }, other);
    await review(doomed.id, { decision: "reject", note: "Non vérifiable" });
    const res = await json<PublicTournamentDetail>(await routes.publicOne.GET(request(`/api/tournaments/public/${id}`, []), params({ id })));
    assert.equal(res.status, 200);
    assert.equal(res.body.shop, null);
    assert.equal(res.body.organizerName, "Panam");
  });

  it("annuaire : badge et mise en avant des boutiques vérifiées à même heure", async () => {
    const startsAt = new Date(Date.now() + 9 * DAY);
    startsAt.setUTCSeconds(0, 0);
    const plain = await publicTournament(VILLEURBANNE, 0, { startsAt });
    const { id: featured } = await newTournament(manager);
    await run(featured, { type: "setShop", shopId: shop.id }, manager);
    await run(featured, { type: "updateSettings", settings: { startsAt } }, manager);
    await run(featured, { type: "setVisibility", public: true }, manager);
    const res = await directory(`city=Villeurbanne&from=${encodeURIComponent(new Date(startsAt.getTime() - 60_000).toISOString())}`);
    const lyon = await directory(`city=Lyon&from=${encodeURIComponent(new Date(startsAt.getTime() - 60_000).toISOString())}`);
    // Le tournoi de la boutique a lieu à Lyon (adresse de la boutique) ; celui sans boutique à Villeurbanne.
    assert.ok(res.ids.includes(plain.id));
    assert.ok(lyon.ids.includes(featured));
    const both = await directory(`lat=${LYON.lat}&lng=${LYON.lng}&radius=25&from=${encodeURIComponent(new Date(startsAt.getTime() - 60_000).toISOString())}&to=${encodeURIComponent(new Date(startsAt.getTime() + 60_000).toISOString())}`);
    assert.deepEqual(both.ids.slice(0, 2), [featured, plain.id]);
    assert.equal(both.body.tournaments.find((row) => row.id === featured)?.shop?.verified, true);
  });
});

describe("annuaire des tournois", () => {
  it("filtres de lieu, rayon, période, format, prix, places", async () => {
    const lyonFree = await publicTournament(LYON, 2, { format: "boutique", matchType: "bo3" });
    const lyonPaid = await publicTournament(LYON, 20, { format: "competitif", matchType: "bo1", entryFeeCents: 1000, maxPlayers: 2 });
    const paris = await publicTournament(PARIS, 3);
    const bruxelles = await publicTournament(BRUXELLES, 3);
    const privateOne = await newTournament();
    await run(privateOne.id, { type: "updateSettings", settings: { startsAt: new Date(Date.now() + DAY), place: LYON } });
    await guest(lyonPaid.id, "A");
    await guest(lyonPaid.id, "B");

    const lyon = await directory("country=FR&city=lyon");
    assert.ok(lyon.ids.includes(lyonFree.id) && lyon.ids.includes(lyonPaid.id));
    assert.ok(!lyon.ids.includes(paris.id) && !lyon.ids.includes(privateOne.id), "jamais de tournoi privé");

    const near = await directory(`lat=${LYON.lat}&lng=${LYON.lng}&radius=25&sort=distance`);
    assert.ok(near.ids.includes(lyonFree.id) && !near.ids.includes(paris.id));
    assert.equal(near.body.tournaments.find((row) => row.id === lyonFree.id)?.distanceKm, 0);

    const week = await directory(`from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 7 * DAY).toISOString())}&country=FR`);
    assert.ok(week.ids.includes(lyonFree.id) && !week.ids.includes(lyonPaid.id));

    const combined = await directory("price=free&match=bo3&format=boutique&country=FR&city=Lyon");
    assert.ok(combined.ids.includes(lyonFree.id) && !combined.ids.includes(lyonPaid.id));

    const seats = await directory("seats=1&country=FR&city=Lyon");
    assert.ok(!seats.ids.includes(lyonPaid.id), "complet : exclu avec « places restantes »");

    const belgium = await directory("country=BE");
    assert.ok(belgium.ids.includes(bruxelles.id) && !belgium.ids.includes(lyonFree.id));

    const bad = await directory("radius=30&lat=45&lng=4");
    assert.equal(bad.status, 400);
  });

  it("listes de choix limitées au pays choisi", async () => {
    await publicTournament(BRUXELLES, 5);
    const res = await json<{ countries: string[]; regions: string[]; cities: { name: string }[] }>(
      await routes.facets.GET(request("/api/tournaments/public/facets?country=BE", [])),
    );
    assert.ok(res.body.countries.includes("BE") && res.body.countries.includes("FR"));
    assert.deepEqual(res.body.regions, ["Bruxelles-Capitale"]);
    assert.ok(res.body.cities.every((city) => city.name === "Bruxelles"));
  });

  it("un tournoi commencé depuis plus de 12 h n'est plus listé", async () => {
    const { id } = await publicTournament(LYON, 1);
    await prisma.tournament.update({ where: { id }, data: { startsAt: new Date(Date.now() - 14 * 60 * 60_000) } });
    assert.ok(!(await directory("country=FR&city=Lyon")).ids.includes(id));
  });
});

describe("routes de géocodage", () => {
  it("session requise pour saisir une adresse", async () => {
    assert.equal((await routes.suggest.GET(request("/api/geocode/suggest?q=12+rue", []))).status, 401);
    const resolve = await routes.resolve.POST(request("/api/geocode/resolve", [], { method: "POST", body: JSON.stringify({ country: "BE", street: "A", city: "B" }) }));
    assert.equal(resolve.status, 401);
  });

  it("au-delà de 30 recherches par minute : 429", async () => {
    const ip = `10.99.${Math.floor(Math.random() * 250)}.1`;
    let last = 0;
    for (let i = 0; i < 31; i += 1) {
      // Pays hors France : aucune requête réseau (pas d'autocomplétion), seul le limiteur compte.
      last = (await routes.suggest.GET(request("/api/geocode/suggest?q=Rue+Neuve&country=BE", [session(owner)], {}, ip))).status;
    }
    assert.equal(last, 429);
  });
});
