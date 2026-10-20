/**
 * Partage d'un deck : création idempotente, renouvellement, révocation, isolation entre comptes,
 * suppression en cascade avec le deck et absence de données privées dans la vue publique.
 * Comptes @example.com supprimés en fin de test (cascade sur les decks et les liens).
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it, vi } from "vitest";
import { DELETE as revokeRoute, GET as readRoute, POST as shareRoute } from "../../src/app/api/decks/[id]/share/route";
import { SESSION_COOKIE, createSession, registerAccount } from "../../src/lib/auth";
import { isDeckCard } from "../../src/lib/deck-rules";
import { createShareToken } from "../../src/lib/share-token";
import { deckSharePath, loadSharedDeck } from "../../src/lib/deck-share";
import { prisma } from "../../src/lib/prisma";

// `unstable_cache` exige le contexte d'un serveur Next : le catalogue est lu directement.
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));

type ShareBody = { active: boolean; token?: string; path?: string; url?: string; createdAt?: string };

const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds: string[] = [];
const password = "motdepasse-robuste";
const SECRET_NOTE = `note-de-deck-privee-${stamp}`;

async function makeAccount(label: string) {
  const email = `deckshare.${label}.${stamp}@example.com`;
  const user = await registerAccount({ email, password, displayName: `Decks ${label}` });
  createdUserIds.push(user.id);
  const session = await createSession(user.id);
  return { id: user.id, email, token: session.token };
}

function request(path: string, token: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (token) headers.set("cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}`);
  return new Request(`http://127.0.0.1${path}`, { ...init, headers });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function call(method: "GET" | "POST" | "DELETE", deckId: string, token: string | null, body?: unknown) {
  const init: RequestInit = { method, body: body === undefined ? undefined : JSON.stringify(body) };
  const req = request(`/api/decks/${deckId}/share`, token, init);
  const handler = method === "GET" ? readRoute : method === "POST" ? shareRoute : revokeRoute;
  const response = await handler(req, params(deckId));
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as ShareBody };
}

afterAll(async () => {
  try {
    if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  } finally {
    await prisma.$disconnect();
  }
});

describe.sequential("partage d'un deck", () => {
  let owner: Awaited<ReturnType<typeof makeAccount>>;
  let other: Awaited<ReturnType<typeof makeAccount>>;
  let deckId: string;
  let firstToken: string;
  let currentToken: string;
  let cardIds: string[];

  beforeAll(async () => {
    const cards = await prisma.card.findMany({ where: { isActive: true }, select: { id: true, cardType: true }, take: 50 });
    cardIds = cards.filter(isDeckCard).slice(0, 2).map((card) => card.id);
    assert.equal(cardIds.length, 2, "catalogue de cartes indisponible");
    owner = await makeAccount("proprio");
    other = await makeAccount("autre");
    const deck = await prisma.deck.create({
      data: {
        userId: owner.id,
        name: `Deck partagé ${stamp}`,
        notes: SECRET_NOTE,
        cards: { create: [{ cardId: cardIds[0], quantity: 3 }] },
      },
    });
    deckId = deck.id;
  });

  it("refuse la gestion du lien sans session", async () => {
    for (const method of ["GET", "POST", "DELETE"] as const) {
      assert.equal((await call(method, deckId, null)).status, 401, method);
    }
  });

  it("aucun lien actif au départ", async () => {
    const read = await call("GET", deckId, owner.token);
    assert.equal(read.status, 200);
    assert.deepEqual(read.body, { active: false });
  });

  it("crée un lien, puis renvoie le même à chaque demande", async () => {
    const created = await call("POST", deckId, owner.token);
    assert.equal(created.status, 200);
    assert.equal(created.body.active, true);
    assert.ok(created.body.token && created.body.token.length >= 32, "jeton suffisamment long");
    assert.match(created.body.token, /^[A-Za-z0-9_-]+$/);
    assert.ok(!created.body.token.includes(deckId), "le jeton ne contient pas l'id du deck");
    assert.equal(created.body.path, `/fr/deck/${created.body.token}`);
    assert.ok(created.body.url?.endsWith(`/fr/deck/${created.body.token}`));
    firstToken = created.body.token;

    for (const body of [undefined, {}, { rotate: false }]) {
      const again = await call("POST", deckId, owner.token, body);
      assert.equal(again.body.token, firstToken, "création idempotente");
    }
    assert.equal((await call("GET", deckId, owner.token)).body.token, firstToken);
    assert.equal(await prisma.deckShare.count({ where: { deckId } }), 1, "un seul lien par deck");
  });

  it("refuse un corps mal typé sans toucher au lien", async () => {
    assert.equal((await call("POST", deckId, owner.token, { rotate: "oui" })).status, 400);
    assert.equal((await prisma.deckShare.findUnique({ where: { deckId } }))?.token, firstToken);
  });

  it("le deck d'un autre compte est refusé comme s'il n'existait pas", async () => {
    for (const method of ["GET", "POST", "DELETE"] as const) {
      assert.equal((await call(method, deckId, other.token, method === "POST" ? { rotate: true } : undefined)).status, 404, method);
    }
    assert.equal((await call("GET", "deck-inexistant", owner.token)).status, 404, "deck inconnu");
    assert.equal((await prisma.deckShare.findUnique({ where: { deckId } }))?.token, firstToken, "lien inchangé");
  });

  it("la vue publique ne montre que le nom, le propriétaire et les cartes", async () => {
    const shared = await loadSharedDeck(firstToken);
    assert.ok(shared);
    assert.deepEqual(Object.keys(shared).sort(), ["cards", "name", "owner", "updatedAt"]);
    assert.equal(shared.name, `Deck partagé ${stamp}`);
    assert.deepEqual(shared.owner, { displayName: "Decks proprio" });
    assert.deepEqual(shared.cards, [{ cardId: cardIds[0], quantity: 3 }]);
    const raw = JSON.stringify(shared);
    for (const secret of [SECRET_NOTE, owner.email, owner.id, deckId]) {
      assert.ok(!raw.includes(secret), `la vue publique ne doit pas contenir « ${secret} »`);
    }
  });

  it("la vue publique suit le deck en direct", async () => {
    await prisma.deckCard.create({ data: { deckId, cardId: cardIds[1], quantity: 2 } });
    const shared = await loadSharedDeck(firstToken);
    assert.equal(shared?.cards.length, 2);
  });

  it("page /deck/[token] : noindex, titre et image d'aperçu ; 404 pour un lien inconnu", async () => {
    const page = await import("../../src/app/[locale]/deck/[token]/page");
    const props = (token: string) => ({ params: Promise.resolve({ locale: "en", token }) });
    const meta = await page.generateMetadata(props(firstToken));
    assert.deepEqual(meta.robots, { index: false, follow: false }, "jamais indexée");
    assert.equal(meta.title, `Deck partagé ${stamp}`);
    assert.match(String(meta.description), /^Deck by Decks proprio · 5 cards/);
    const images = meta.openGraph?.images as { url: string }[];
    assert.equal(images[0]?.url, `/og/deck/${firstToken}/en`);
    for (const secret of [SECRET_NOTE, owner.email]) assert.ok(!JSON.stringify(meta).includes(secret));

    const unknown = await page.generateMetadata(props(createShareToken()));
    assert.deepEqual(unknown.robots, { index: false, follow: false });
    assert.equal(unknown.openGraph, undefined, "aucun aperçu pour un lien inactif");

    assert.ok(await page.default(props(firstToken)), "un lien actif rend la page");
    await assert.rejects(
      async () => page.default(props(createShareToken())),
      (error: unknown) => String((error as { digest?: string })?.digest ?? "").includes("404"),
      "notFound() attendu",
    );
  });

  it("jeton inconnu ou mal formé : aucun deck", async () => {
    assert.equal(await loadSharedDeck(createShareToken()), null);
    assert.equal(await loadSharedDeck("court"), null);
    assert.equal(await loadSharedDeck(`${firstToken}x`), null);
  });

  it("le renouvellement invalide l'ancien jeton", async () => {
    const rotated = await call("POST", deckId, owner.token, { rotate: true });
    assert.ok(rotated.body.token);
    assert.notEqual(rotated.body.token, firstToken);
    currentToken = rotated.body.token;
    assert.equal(await loadSharedDeck(firstToken), null, "l'ancien lien ne fonctionne plus");
    assert.ok(await loadSharedDeck(currentToken), "le nouveau lien fonctionne");
    assert.equal(await prisma.deckShare.count({ where: { deckId } }), 1);
  });

  it("la révocation coupe le lien", async () => {
    const revoked = await call("DELETE", deckId, owner.token);
    assert.deepEqual(revoked.body, { active: false });
    assert.equal(await loadSharedDeck(currentToken), null);
    assert.equal((await call("DELETE", deckId, owner.token)).status, 200, "révoquer deux fois est sans erreur");
    const recreated = await call("POST", deckId, owner.token);
    assert.ok(recreated.body.token && ![firstToken, currentToken].includes(recreated.body.token), "jamais un ancien jeton");
    currentToken = recreated.body.token;
  });

  it("la suppression du deck supprime son lien", async () => {
    await prisma.deck.delete({ where: { id: deckId } });
    assert.equal(await prisma.deckShare.count({ where: { token: currentToken } }), 0);
    assert.equal(await loadSharedDeck(currentToken), null);
  });

  it("adresse du lien dans la langue de celui qui partage", () => {
    assert.equal(deckSharePath("abc"), "/fr/deck/abc");
    assert.equal(deckSharePath("abc", "de"), "/de/deck/abc");
  });
});
