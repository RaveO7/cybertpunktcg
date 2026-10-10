/**
 * Decks : routes /api/decks, validation des entrées, isolation entre comptes, cascade.
 * Travaille sur une COPIE de la base SQLite (tests/helpers/db-copy.ts) avec ses propres cartes :
 * la vraie base n'est jamais ouverte.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";
import type { DeckDTO } from "../../src/lib/types";

type Prisma = typeof import("../../src/lib/prisma").prisma;
type Routes = {
  list: typeof import("../../src/app/api/decks/route");
  item: typeof import("../../src/app/api/decks/[id]/route");
};

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let db: Awaited<ReturnType<typeof openDatabaseCopy>> | null = null;
let prisma: Prisma;
let routes: Routes;
let sessionCookie: string;
const userIds: string[] = [];
const C: Record<"legend" | "unit" | "sealed" | "inactive", string> = { legend: "", unit: "", sealed: "", inactive: "" };
let owner: { token: string };
let other: { token: string };

function request(url: string, token: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (token) headers.set("cookie", `${sessionCookie}=${encodeURIComponent(token)}`);
  return new Request(`http://127.0.0.1${url}`, { ...init, headers });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function create(token: string, body: unknown) {
  const response = await routes.list.POST(request("/api/decks", token, { method: "POST", body: JSON.stringify(body) }));
  return { status: response.status, body: (await response.json()) as { deck?: DeckDTO; error?: string } };
}

async function patch(token: string, id: string, body: unknown) {
  const response = await routes.item.PATCH(
    request(`/api/decks/${id}`, token, { method: "PATCH", body: JSON.stringify(body) }),
    params(id),
  );
  return { status: response.status, body: (await response.json()) as { deck?: DeckDTO; error?: string } };
}

async function list(token: string) {
  const response = await routes.list.GET(request("/api/decks", token));
  assert.equal(response.status, 200);
  return ((await response.json()) as { decks: DeckDTO[] }).decks;
}

beforeAll(async () => {
  db = await openDatabaseCopy("cptcg-decks-");
  prisma = db.prisma;
  routes = {
    list: await import("../../src/app/api/decks/route"),
    item: await import("../../src/app/api/decks/[id]/route"),
  };
  const auth = await import("../../src/lib/auth");
  sessionCookie = auth.SESSION_COOKIE;

  const fixtures = [
    { key: "legend", cardType: "Legend", isActive: true },
    { key: "unit", cardType: "Unit", isActive: true },
    { key: "sealed", cardType: "Sealed", isActive: true },
    { key: "inactive", cardType: "Unit", isActive: false },
  ] as const;
  for (const fixture of fixtures) {
    const id = `deck-${stamp}-${fixture.key}`;
    const card = await prisma.card.create({
      data: {
        externalId: id,
        code: id,
        slug: id,
        name: id,
        displayName: id,
        canonicalName: id,
        cardType: fixture.cardType,
        color: "Red",
        ram: 1,
        isActive: fixture.isActive,
      },
    });
    C[fixture.key] = card.id;
  }

  const makeAccount = async (label: string) => {
    const user = await auth.registerAccount({
      email: `decks.${label}.${stamp}@example.com`,
      password: "motdepasse-robuste",
      displayName: `Decks ${label}`,
    });
    userIds.push(user.id);
    return { token: (await auth.createSession(user.id)).token };
  };
  owner = await makeAccount("owner");
  other = await makeAccount("other");
});

afterAll(async () => {
  try {
    if (prisma && userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  } finally {
    await db?.cleanup();
  }
});

describe.sequential("decks (copie)", () => {
  it("refuse les requêtes sans session et les entrées invalides", async () => {
    assert.equal((await routes.list.GET(request("/api/decks", null))).status, 401);
    assert.equal((await create(owner.token, { name: "  " })).status, 400);
    assert.equal((await create(owner.token, { name: "x".repeat(61) })).status, 400);
    assert.equal((await create(owner.token, { cards: [{ cardId: C.unit, quantity: 0 }] })).status, 400);
    assert.equal((await create(owner.token, { cards: [{ cardId: C.unit, quantity: 10 }] })).status, 400);
    // Produit scellé, carte retirée ou inconnue : refusés.
    for (const cardId of [C.sealed, C.inactive, "inconnue"]) {
      const result = await create(owner.token, { cards: [{ cardId, quantity: 1 }] });
      assert.equal(result.status, 400);
      assert.equal(result.body.error, "Carte introuvable.");
    }
    assert.deepEqual(await list(owner.token), []);
  });

  it("création avec un nom par défaut, puis avec cartes (doublons regroupés)", async () => {
    const empty = await create(owner.token, {});
    assert.equal(empty.status, 200);
    assert.equal(empty.body.deck?.name, "Nouveau deck");
    assert.deepEqual(empty.body.deck?.cards, []);

    const full = await create(owner.token, {
      name: "  Rouge  ",
      cards: [
        { cardId: C.legend, quantity: 1 },
        { cardId: C.unit, quantity: 2 },
        { cardId: C.unit, quantity: 2 },
      ],
    });
    assert.equal(full.status, 200);
    assert.equal(full.body.deck?.name, "Rouge");
    const quantities = Object.fromEntries(full.body.deck!.cards.map((card) => [card.cardId, card.quantity]));
    assert.deepEqual(quantities, { [C.legend]: 1, [C.unit]: 4 });
    // Le plus récemment modifié en premier.
    assert.deepEqual((await list(owner.token)).map((deck) => deck.name), ["Rouge", "Nouveau deck"]);
  });

  it("mise à jour : renommer seul conserve les cartes, une nouvelle liste remplace l'ancienne", async () => {
    const [deck] = await list(owner.token);
    const renamed = await patch(owner.token, deck.id, { name: "Rouge v2" });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.body.deck?.name, "Rouge v2");
    assert.equal(renamed.body.deck?.cards.length, 2);

    const replaced = await patch(owner.token, deck.id, { cards: [{ cardId: C.unit, quantity: 3 }] });
    assert.deepEqual(replaced.body.deck?.cards, [{ cardId: C.unit, quantity: 3 }]);
    assert.equal(await prisma.deckCard.count({ where: { deckId: deck.id } }), 1);

    // Une liste invalide ne touche pas au deck.
    const rejected = await patch(owner.token, deck.id, { cards: [{ cardId: C.sealed, quantity: 1 }] });
    assert.equal(rejected.status, 400);
    assert.deepEqual((await list(owner.token)).find((entry) => entry.id === deck.id)?.cards, [{ cardId: C.unit, quantity: 3 }]);

    assert.equal((await patch(owner.token, "inconnu", { name: "x" })).status, 404);
  });

  it("isolation : un autre compte ne voit, ne modifie ni ne supprime les decks", async () => {
    assert.deepEqual(await list(other.token), []);
    const [deck] = await list(owner.token);
    assert.equal((await patch(other.token, deck.id, { name: "Volé" })).status, 404);
    const removed = await routes.item.DELETE(request(`/api/decks/${deck.id}`, other.token, { method: "DELETE" }), params(deck.id));
    assert.deepEqual(await removed.json(), { deletedId: null });
    assert.equal((await list(owner.token))[0].name, "Rouge v2");
  });

  it("suppression d'un deck, puis cascade quand la carte disparaît du catalogue", async () => {
    const [first, second] = await list(owner.token);
    const removed = await routes.item.DELETE(request(`/api/decks/${first.id}`, owner.token, { method: "DELETE" }), params(first.id));
    assert.deepEqual(await removed.json(), { deletedId: first.id });
    assert.equal(await prisma.deckCard.count({ where: { deckId: first.id } }), 0);

    await patch(owner.token, second.id, { cards: [{ cardId: C.legend, quantity: 1 }] });
    await prisma.card.delete({ where: { id: C.legend } });
    assert.deepEqual((await list(owner.token))[0].cards, []);
  });
});
