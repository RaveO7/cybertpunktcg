/**
 * Référencement : sitemap (boutiques, tournois, cartes) et métadonnées des fiches publiques
 * (versions linguistiques, noindex d'un tournoi annulé, page introuvable).
 * Cf. openspec/changes/optimize-seo/specs/seo/{crawling,metadata}.
 * Travaille sur une COPIE de la base SQLite ; tout ce qui est créé est supprimé dans afterAll.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";
import type { OrganizerCommand } from "../../src/lib/api-schemas";
import type { Place } from "../../src/lib/geo/location";

type Prisma = typeof import("../../src/lib/prisma").prisma;
type Commands = typeof import("../../src/lib/tournament/commands");

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const DAY = 24 * 60 * 60_000;
const SITE = "https://seo.example.com";
const LYON: Place = {
  venueName: "Arasaka Games",
  address: "12 Rue de la République",
  postalCode: "69002",
  city: "Lyon",
  region: "Auvergne-Rhône-Alpes",
  country: "FR",
  lat: 45.764,
  lng: 4.8357,
};

let db: Awaited<ReturnType<typeof openDatabaseCopy>> | null = null;
let prisma: Prisma;
let commands: Commands;
let sitemap: typeof import("../../src/lib/seo/sitemap");
let tournamentPages: typeof import("../../src/components/public-site/tournament-pages");
let shopPages: typeof import("../../src/components/public-site/shop-pages");
const userIds: string[] = [];
const tournamentIds: string[] = [];
let ownerId: string;
let counter = 0;
const previousAppUrl = process.env.APP_URL;

function run(tournamentId: string, command: Record<string, unknown>) {
  return commands.runOrganizerCommand(tournamentId, ownerId, { ...command, clientActionId: `seo-${stamp}-${++counter}` } as OrganizerCommand);
}

async function tournament(options: { publicInDays?: number; cancel?: boolean; name?: string } = {}) {
  await prisma.rateLimit.deleteMany({ where: { key: `tournament-publish:${ownerId}` } });
  const created = await commands.createTournament(ownerId, { name: options.name ?? `SEO ${stamp} ${++counter}` });
  tournamentIds.push(created.id);
  if (options.publicInDays !== undefined) {
    await run(created.id, { type: "updateSettings", settings: { startsAt: new Date(Date.now() + options.publicInDays * DAY), place: LYON } });
    await run(created.id, { type: "setVisibility", public: true });
  }
  if (options.cancel) await run(created.id, { type: "cancel" });
  return created.id;
}

async function shop(slug: string, status: string) {
  const row = await prisma.shop.create({
    data: {
      ownerId,
      slug,
      name: `Boutique ${slug}`,
      status,
      address: LYON.address,
      postalCode: LYON.postalCode,
      city: LYON.city,
      cityKey: "lyon",
      region: LYON.region,
      country: LYON.country,
      lat: LYON.lat,
      lng: LYON.lng,
    },
  });
  return row.slug;
}

beforeAll(async () => {
  process.env.APP_URL = SITE;
  db = await openDatabaseCopy("cptcg-seo-");
  prisma = db.prisma;
  commands = await import("../../src/lib/tournament/commands");
  sitemap = await import("../../src/lib/seo/sitemap");
  tournamentPages = await import("../../src/components/public-site/tournament-pages");
  shopPages = await import("../../src/components/public-site/shop-pages");
  const auth = await import("../../src/lib/auth");
  const user = await auth.registerAccount({ email: `seo.owner.${stamp}@example.com`, password: "motdepasse-robuste", displayName: "SEO" });
  userIds.push(user.id);
  ownerId = user.id;
});

afterAll(async () => {
  if (previousAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = previousAppUrl;
  try {
    if (prisma && tournamentIds.length) await prisma.tournament.deleteMany({ where: { id: { in: tournamentIds } } });
    // Supprimer le compte supprime aussi ses boutiques (cascade).
    if (prisma && userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (prisma) await prisma.rateLimit.deleteMany({ where: { key: { startsWith: "tournament-" } } });
  } finally {
    await db?.cleanup();
  }
});

describe("sitemap", () => {
  it("liste les boutiques non refusées et les tournois publics non annulés, en FR et EN", async () => {
    const pending = await shop(`seo-pending-${stamp}`, "pending");
    const rejected = await shop(`seo-rejected-${stamp}`, "rejected");
    const privateId = await tournament();
    const cancelledId = await tournament({ publicInDays: 5, cancel: true });
    const upcomingId = await tournament({ publicInDays: 10 });

    const entries = await sitemap.buildSitemap();
    const urls = new Set(entries.map((entry) => entry.url));

    assert.ok(urls.has(`${SITE}/boutiques/${pending}`));
    assert.ok(urls.has(`${SITE}/en/shops/${pending}`));
    assert.ok(!urls.has(`${SITE}/boutiques/${rejected}`));
    assert.ok(!urls.has(`${SITE}/tournois/publics/${privateId}`));
    assert.ok(!urls.has(`${SITE}/tournois/publics/${cancelledId}`));
    assert.ok(urls.has(`${SITE}/tournois/publics/${upcomingId}`));

    const upcoming = entries.find((entry) => entry.url === `${SITE}/en/tournaments/${upcomingId}`);
    assert.deepEqual(upcoming?.alternates?.languages, {
      fr: `${SITE}/tournois/publics/${upcomingId}`,
      en: `${SITE}/en/tournaments/${upcomingId}`,
    });
    assert.ok(upcoming?.lastModified instanceof Date);
  });

  it("accueil, liste des cartes, pages légales sans alternative et fiches de carte hors scellés", async () => {
    const entries = await sitemap.buildSitemap();
    const byUrl = new Map(entries.map((entry) => [entry.url, entry]));
    for (const path of ["/", "/en", "/cartes", "/en/cards"]) {
      assert.ok(byUrl.has(`${SITE}${path}`), path);
    }
    // Plus d'autres pages de liste publiques (la liste des cartes reste) : tout est sur l'accueil.
    for (const path of ["/comment-jouer", "/en/how-to-play", "/tournois/publics", "/boutiques"]) {
      assert.ok(!byUrl.has(`${SITE}${path}`), path);
    }
    const legal = byUrl.get(`${SITE}/cgu`);
    assert.ok(legal);
    assert.equal(legal.alternates, undefined);
    assert.equal(legal.lastModified, undefined);

    const gameCard = await prisma.card.findFirst({ where: { isActive: true, cardType: "Legend" }, select: { slug: true } });
    if (gameCard) {
      assert.ok(byUrl.has(`${SITE}/cartes/${gameCard.slug}`));
      assert.ok(byUrl.get(`${SITE}/en/cards/${gameCard.slug}`)?.lastModified instanceof Date);
    }
    const sealed = await prisma.card.findFirst({ where: { cardType: "Sealed" }, select: { slug: true } });
    if (sealed) assert.ok(!byUrl.has(`${SITE}/cartes/${sealed.slug}`));
  });

  it("modifier un tournoi met à jour sa date de modification", async () => {
    const id = await tournament({ publicInDays: 12 });
    const before = (await sitemap.buildSitemap()).find((entry) => entry.url === `${SITE}/tournois/publics/${id}`)?.lastModified as Date;
    await new Promise((resolve) => setTimeout(resolve, 20));
    await run(id, { type: "updateSettings", settings: { description: "Nouvelle description" } });
    const after = (await sitemap.buildSitemap()).find((entry) => entry.url === `${SITE}/tournois/publics/${id}`)?.lastModified as Date;
    assert.ok(after.getTime() > before.getTime());
  });
});

describe("métadonnées des fiches", () => {
  it("tournoi public : titre, canonique et hreflang ; annulé : noindex", async () => {
    const id = await tournament({ publicInDays: 7, name: `Night City Open ${stamp}` });
    const meta = await tournamentPages.tournamentMetadata("en", id);
    assert.match(String(meta.title), /Night City Open .* — Cyberpunk TCG tournament/);
    assert.equal(meta.alternates?.canonical, `/en/tournaments/${id}`);
    assert.deepEqual(meta.alternates?.languages, { fr: `/tournois/publics/${id}`, en: `/en/tournaments/${id}`, "x-default": `/tournois/publics/${id}` });
    assert.equal(meta.robots, undefined);
    assert.ok(String(meta.description).length <= 160);

    const cancelled = await tournament({ publicInDays: 7, cancel: true });
    const cancelledMeta = await tournamentPages.tournamentMetadata("fr", cancelled);
    assert.deepEqual(cancelledMeta.robots, { index: false, follow: true });
  });

  it("tournoi privé ou inconnu : noindex", async () => {
    const privateId = await tournament();
    assert.deepEqual((await tournamentPages.tournamentMetadata("fr", privateId)).robots, { index: false, follow: false });
    assert.deepEqual((await tournamentPages.tournamentMetadata("fr", "inconnu")).robots, { index: false, follow: false });
  });

  it("boutique : titre localisé et description par défaut", async () => {
    const slug = await shop(`seo-meta-${stamp}`, "verified");
    const fr = await shopPages.shopMetadata("fr", slug);
    const title = typeof fr.title === "string" ? fr.title : (fr.title as { absolute: string }).absolute;
    assert.match(title, /^Boutique seo-meta-.*, boutique Cyberpunk TCG à Lyon$/);
    assert.ok(title.length <= 70);
    assert.match(String(fr.description), /tournois Cyberpunk TCG à venir/);
    const en = await shopPages.shopMetadata("en", slug);
    assert.equal(en.alternates?.canonical, `/en/shops/${slug}`);
    const rejected = await shop(`seo-meta-rejected-${stamp}`, "rejected");
    assert.deepEqual((await shopPages.shopMetadata("fr", rejected)).robots, { index: false, follow: false });
  });
});
