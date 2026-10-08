/**
 * Partage public du classeur : création, renouvellement, révocation, lecture par jeton
 * et absence de fuite de données privées dans la vue publique.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { DELETE as revokeRoute, GET as readShareRoute, POST as shareRoute } from "../../src/app/api/share/route";
import { GET as publicRoute } from "../../src/app/api/share/[token]/route";
import { SESSION_COOKIE, createSession, registerAccount } from "../../src/lib/auth";
import { prisma } from "../../src/lib/prisma";
import {
  absoluteShareUrl,
  createShareToken,
  loadSharedBinder,
  shareExists,
  sharePath,
} from "../../src/lib/share";

type ShareBody = { active: boolean; token?: string; path?: string; url?: string; createdAt?: string };
type Binder = {
  owner: Record<string, unknown>;
  items: Record<string, unknown>[];
  createdAt: string;
};

const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds: string[] = [];
const password = "motdepasse-robuste";
const SECRET_NOTE = `note-tres-privee-${stamp}`;

async function makeAccount(label: string) {
  const email = `share.${label}.${stamp}@example.com`;
  const user = await registerAccount({ email, password, displayName: `Classeur ${label}` });
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

async function json<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`réponse non JSON ${response.status}: ${text.slice(0, 200)}`);
  }
}

function readPublic(token: string) {
  return publicRoute(new Request(`http://127.0.0.1/api/share/${encodeURIComponent(token)}`), {
    params: Promise.resolve({ token }),
  });
}

async function createShare(token: string, body?: unknown) {
  const response = await shareRoute(
    request("/api/share", token, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  );
  assert.equal(response.status, 200, "création du lien");
  return json<ShareBody>(response);
}

afterAll(async () => {
  if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe.sequential("partage du classeur", () => {
  let owner: Awaited<ReturnType<typeof makeAccount>>;
  let other: Awaited<ReturnType<typeof makeAccount>>;
  let firstToken: string;
  let currentToken: string;

  beforeAll(async () => {
    const printings = await prisma.printing.findMany({ where: { isActive: true }, select: { id: true }, take: 2 });
    const condition = await prisma.condition.findFirst({ orderBy: { sortOrder: "asc" } });
    assert.equal(printings.length, 2, "catalogue de cartes indisponible");
    assert.ok(condition, "états de cartes indisponibles");
    owner = await makeAccount("proprio");
    other = await makeAccount("autre");
    await prisma.collectionItem.create({
      data: {
        userId: owner.id,
        printingId: printings[0].id,
        conditionId: condition.id,
        quantity: 3,
        notes: SECRET_NOTE,
        purchasePrice: "987.65",
        purchaseCurrency: "GBP",
      },
    });
    // Ligne à 0 : ne doit jamais apparaître dans la vue publique.
    await prisma.collectionItem.create({
      data: { userId: owner.id, printingId: printings[1].id, conditionId: condition.id, quantity: 0 },
    });
  });

  it("refuse la gestion du lien sans session", async () => {
    assert.equal((await readShareRoute(request("/api/share", null))).status, 401);
    assert.equal((await shareRoute(request("/api/share", null, { method: "POST" }))).status, 401);
    assert.equal((await revokeRoute(request("/api/share", null, { method: "DELETE" }))).status, 401);
    assert.equal((await readShareRoute(request("/api/share", "jeton-invente"))).status, 401);
  });

  it("aucun lien actif au départ", async () => {
    const response = await readShareRoute(request("/api/share", owner.token));
    assert.equal(response.status, 200);
    assert.deepEqual(await json<ShareBody>(response), { active: false });
  });

  it("crée un lien (corps absent accepté) puis le relit", async () => {
    const created = await createShare(owner.token);
    assert.equal(created.active, true);
    assert.ok(created.token && created.token.length >= 32, "jeton suffisamment long");
    assert.match(created.token, /^[A-Za-z0-9_-]+$/, "jeton sûr pour une URL");
    assert.equal(created.path, `/classeur/${created.token}`);
    // APP_URL (si défini dans .env) prime sur l'origine de la requête.
    assert.equal(created.url, absoluteShareUrl(new Request("http://127.0.0.1/api/share"), created.token));
    assert.ok(created.url?.endsWith(`/classeur/${created.token}`));
    firstToken = created.token;

    const read = await json<ShareBody>(await readShareRoute(request("/api/share", owner.token)));
    assert.equal(read.token, firstToken);
    assert.equal(await prisma.collectionShare.count({ where: { userId: owner.id } }), 1);
  });

  it("un second POST sans rotation garde le même jeton", async () => {
    const again = await createShare(owner.token, {});
    assert.equal(again.token, firstToken);
    const again2 = await createShare(owner.token, { rotate: false });
    assert.equal(again2.token, firstToken);
    assert.equal(await prisma.collectionShare.count({ where: { userId: owner.id } }), 1, "un seul lien par compte");
  });

  it("refuse un corps mal typé", async () => {
    const response = await shareRoute(
      request("/api/share", owner.token, { method: "POST", body: JSON.stringify({ rotate: "oui" }) }),
    );
    assert.equal(response.status, 400);
    assert.equal(
      (await prisma.collectionShare.findUnique({ where: { userId: owner.id } }))?.token,
      firstToken,
      "un corps invalide ne change pas le lien",
    );
  });

  it("la vue publique montre les cartes sans aucune donnée privée", async () => {
    const response = await readPublic(firstToken);
    assert.equal(response.status, 200);
    const raw = await response.clone().text();
    const binder = await json<Binder>(response);
    assert.deepEqual(binder.owner, { displayName: "Classeur proprio" }, "seul le nom affiché est public");
    assert.equal(binder.items.length, 1, "les lignes à 0 sont masquées");
    const [item] = binder.items;
    assert.equal(item.quantity, 3);
    assert.equal(item.notes, null);
    assert.equal(item.purchasePrice, null);
    assert.equal(item.purchaseCurrency, null);
    assert.ok(!("userId" in item), "pas d'identifiant de compte par ligne");
    for (const secret of [SECRET_NOTE, "987.65", "987,65", "GBP", owner.email, owner.id, password]) {
      assert.ok(!raw.includes(secret), `la vue publique ne doit pas contenir « ${secret} »`);
    }
    assert.ok(!/passwordHash|tokenHash|email/i.test(raw), "aucun champ sensible dans la réponse");
  });

  it("jeton invalide, inconnu ou forgé", async () => {
    for (const bad of ["", "court", "x".repeat(129)]) {
      assert.equal((await readPublic(bad)).status, 400, `format refusé : « ${bad.slice(0, 10)} »`);
    }
    const unknown = createShareToken();
    assert.equal((await readPublic(unknown)).status, 404, "jeton bien formé mais inconnu");
    // Variantes proches du vrai jeton : aucune ne doit ouvrir le classeur.
    const forged = [
      firstToken.toUpperCase() === firstToken ? firstToken.toLowerCase() : firstToken.toUpperCase(),
      `${firstToken}x`,
      firstToken.slice(0, -1),
      ` ${firstToken}`,
      `${firstToken.slice(0, 20)}%' OR '1'='1`,
      owner.id.padEnd(16, "0"),
    ];
    for (const token of forged) {
      const status = (await readPublic(token)).status;
      assert.ok(status === 404 || status === 400, `jeton forgé « ${token.slice(0, 12)}… » : ${status}`);
      assert.equal(await shareExists(token), false);
    }
    assert.equal(await shareExists(firstToken), true);
    assert.equal(await shareExists("court"), false, "format invalide : pas de requête");
    assert.equal(await loadSharedBinder(unknown), null);
  });

  it("le renouvellement invalide l'ancien jeton", async () => {
    const rotated = await createShare(owner.token, { rotate: true });
    assert.ok(rotated.token);
    assert.notEqual(rotated.token, firstToken);
    currentToken = rotated.token;
    assert.equal((await readPublic(firstToken)).status, 404, "l'ancien lien ne fonctionne plus");
    assert.equal(await shareExists(firstToken), false);
    assert.equal((await readPublic(currentToken)).status, 200, "le nouveau lien fonctionne");
    assert.equal(await prisma.collectionShare.count({ where: { userId: owner.id } }), 1);
  });

  it("un autre compte ne peut ni révoquer ni lire la gestion du lien d'autrui", async () => {
    const otherView = await json<ShareBody>(await readShareRoute(request("/api/share", other.token)));
    assert.deepEqual(otherView, { active: false }, "B ne voit pas le lien de A");

    const revoked = await revokeRoute(request("/api/share", other.token, { method: "DELETE" }));
    assert.equal(revoked.status, 200);
    assert.equal((await readPublic(currentToken)).status, 200, "la révocation de B n'affecte pas A");

    const otherShare = await createShare(other.token, { rotate: true });
    assert.ok(otherShare.token);
    assert.notEqual(otherShare.token, currentToken);
    assert.equal((await readPublic(currentToken)).status, 200, "la rotation de B n'affecte pas A");
    const otherBinder = await json<Binder>(await readPublic(otherShare.token));
    assert.equal(otherBinder.items.length, 0, "le lien de B montre la collection de B");
    assert.equal(otherBinder.owner.displayName, "Classeur autre");
  });

  it("la vue publique suit la collection en direct", async () => {
    const line = await prisma.collectionItem.findFirstOrThrow({ where: { userId: owner.id, quantity: { gt: 0 } } });
    await prisma.collectionItem.update({ where: { id: line.id }, data: { quantity: 5 } });
    const binder = await json<Binder>(await readPublic(currentToken));
    assert.equal(binder.items[0]?.quantity, 5);
  });

  it("la révocation coupe le lien ; une nouvelle création donne un autre jeton", async () => {
    const response = await revokeRoute(request("/api/share", owner.token, { method: "DELETE" }));
    assert.deepEqual(await json<ShareBody>(response), { active: false });
    assert.equal((await readPublic(currentToken)).status, 404);
    assert.equal(await shareExists(currentToken), false);
    assert.deepEqual(await json<ShareBody>(await readShareRoute(request("/api/share", owner.token))), { active: false });

    const again = await revokeRoute(request("/api/share", owner.token, { method: "DELETE" }));
    assert.equal(again.status, 200, "révoquer deux fois est sans erreur");

    const recreated = await createShare(owner.token);
    assert.ok(recreated.token);
    assert.ok(![firstToken, currentToken].includes(recreated.token), "jamais un ancien jeton");
    currentToken = recreated.token;
  });

  it("la suppression du compte supprime son lien", async () => {
    const temp = await makeAccount("temporaire");
    const share = await createShare(temp.token);
    assert.ok(share.token);
    await prisma.user.delete({ where: { id: temp.id } });
    assert.equal((await readPublic(share.token)).status, 404);
  });

  it("URL absolue : APP_URL prioritaire, sinon l'origine de la requête", () => {
    const previous = process.env.APP_URL;
    try {
      process.env.APP_URL = "https://classeur.example.com/";
      assert.equal(
        absoluteShareUrl(new Request("http://127.0.0.1:3000/api/share"), "abc"),
        "https://classeur.example.com/classeur/abc",
      );
      delete process.env.APP_URL;
      assert.equal(
        absoluteShareUrl(new Request("http://127.0.0.1:3000/api/share"), "abc"),
        "http://127.0.0.1:3000/classeur/abc",
      );
    } finally {
      if (previous === undefined) delete process.env.APP_URL;
      else process.env.APP_URL = previous;
    }
    assert.equal(sharePath("abc"), "/classeur/abc");
  });

  it("jetons générés uniques et imprévisibles", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => createShareToken()));
    assert.equal(tokens.size, 200);
    for (const token of tokens) assert.equal(token.length, 32, "24 octets en base64url");
  });

  it("les pages /classeur/[token] répondent 404 pour un lien inconnu", async () => {
    const pages = [
      (await import("../../src/app/classeur/[token]/page")).default,
      (await import("../../src/app/classeur/[token]/cartes/page")).default,
    ];
    for (const Page of pages) {
      await assert.rejects(
        async () => Page({ params: Promise.resolve({ token: createShareToken() }) }),
        (error: unknown) => String((error as { digest?: string })?.digest ?? "").includes("404"),
        "notFound() attendu",
      );
      const rendered = await Page({ params: Promise.resolve({ token: currentToken }) });
      assert.ok(rendered, "un lien actif rend la page");
    }
  });
});
