/**
 * Accueil généré à l'avance : toute écriture dans l'annuaire (tournois, inscrits, boutiques) le fait
 * régénérer, y compris dans une transaction ; les autres tables non.
 * Travaille sur une COPIE de la base SQLite ; tout ce qui est créé est supprimé dans afterAll.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", async (original) => ({ ...(await original<typeof import("next/cache")>()), revalidatePath }));

type Prisma = typeof import("../../src/lib/prisma").prisma;

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let db: Awaited<ReturnType<typeof openDatabaseCopy>> | null = null;
let prisma: Prisma;
let commands: typeof import("../../src/lib/tournament/commands");
let userId = "";
let tournamentId = "";

beforeAll(async () => {
  db = await openDatabaseCopy("cptcg-home-revalidation-");
  prisma = db.prisma;
  commands = await import("../../src/lib/tournament/commands");
  const user = await prisma.user.create({ data: { email: `accueil.${stamp}@example.com`, displayName: "Accueil" } });
  userId = user.id;
});

afterAll(async () => {
  try {
    if (prisma && tournamentId) await prisma.tournament.deleteMany({ where: { id: tournamentId } });
    // Supprimer le compte supprime aussi sa boutique (cascade).
    if (prisma && userId) await prisma.user.deleteMany({ where: { id: userId } });
  } finally {
    await db?.cleanup();
  }
});

beforeEach(() => revalidatePath.mockClear());

const homeRevalidated = () => assert.deepEqual(revalidatePath.mock.calls.at(-1), ["/[locale]", "page"]);

describe("régénération de l'accueil", () => {
  it("après la création d'un tournoi", async () => {
    tournamentId = (await commands.createTournament(userId, { name: `Tournoi ${stamp}` })).id;
    homeRevalidated();
  });

  it("après une écriture dans une transaction (inscription)", async () => {
    await prisma.$transaction(async (tx) => {
      await tx.tournamentPlayer.create({ data: { tournamentId, name: `Joueur ${stamp}`, nameKey: `joueur ${stamp}` } });
    });
    homeRevalidated();
  });

  it("après l'enregistrement d'une boutique", async () => {
    await prisma.shop.create({
      data: { slug: `boutique-${stamp}`, ownerId: userId, name: "Boutique", address: "1 rue", city: "Lyon", cityKey: "lyon", country: "FR", lat: 45.76, lng: 4.84 },
    });
    homeRevalidated();
  });

  it("pas pour une table hors de l'annuaire, ni pour une lecture", async () => {
    await prisma.user.update({ where: { id: userId }, data: { displayName: "Accueil 2" } });
    await prisma.tournament.findMany({ where: { id: tournamentId } });
    assert.equal(revalidatePath.mock.calls.length, 0);
  });
});
