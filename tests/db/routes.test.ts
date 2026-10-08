/**
 * Routes restantes : statistiques, catalogue public, session/déconnexion et historique de prix.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, it, vi } from "vitest";

// `unstable_cache` exige le contexte d'un serveur Next (« incrementalCache missing ») :
// hors Next, on le remplace par un appel direct pour tester les routes qui l'utilisent.
vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));
import { POST as logoutRoute } from "../../src/app/api/auth/logout/route";
import { GET as sessionRoute } from "../../src/app/api/auth/session/route";
import { GET as catalogRoute } from "../../src/app/api/catalog/route";
import { GET as historyRoute } from "../../src/app/api/investment/history/route";
import { GET as statsRoute } from "../../src/app/api/stats/route";
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, createSession, registerAccount } from "../../src/lib/auth";
import { loadCatalog } from "../../src/lib/catalog";
import { prisma } from "../../src/lib/prisma";

type Progress = Record<string, unknown>;
type Stats = {
  scope: string;
  mainSetCode: string;
  progress: Progress;
  english: Progress;
  french: Progress;
  rarities: unknown[];
  hasPrices: boolean;
  spent: { totals: [string, number][]; pricedLines: number };
};

const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds: string[] = [];
const password = "motdepasse-robuste";

function request(path: string, session: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (session) headers.set("cookie", `${SESSION_COOKIE}=${encodeURIComponent(session)}`);
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

async function makeAccount(label: string) {
  const email = `routes.${label}.${stamp}@example.com`;
  const user = await registerAccount({ email, password, displayName: `Routes ${label}` });
  createdUserIds.push(user.id);
  return { id: user.id, email, token: (await createSession(user.id)).token };
}

function sessionCookieLine(response: Response) {
  return response.headers.getSetCookie().find((line) => line.startsWith(`${SESSION_COOKIE}=`));
}


afterAll(async () => {
  if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("catalogue", () => {
  it("loadCatalog : forme et cohérence", async () => {
    const catalog = await loadCatalog();
    assert.deepEqual(Object.keys(catalog).sort(), ["cards", "conditions", "hasPrices", "printings", "sets"]);
    assert.ok(catalog.printings.length > 0, "au moins une impression active");
    assert.ok(catalog.conditions.length >= 2);
    const conditionOrder = catalog.conditions.map((condition) => condition.sortOrder);
    assert.deepEqual(conditionOrder, [...conditionOrder].sort((a, b) => a - b), "états triés");
    const cardIds = new Set(catalog.cards.map((card) => card.id));
    const setCodes = new Set(catalog.sets.map((set) => set.code));
    for (const printing of catalog.printings) {
      assert.ok(cardIds.has(printing.cardId), `impression ${printing.id} sans carte active`);
      assert.ok(setCodes.has(printing.setCode), `impression ${printing.id} sans extension`);
      assert.ok(printing.marketPrice === null || Number.isFinite(Number(printing.marketPrice)));
    }
    const trendPrices = await prisma.price.count({ where: { kind: "trend", source: { code: "cardmarket" } } });
    assert.equal(catalog.hasPrices, trendPrices > 0, "hasPrices reflète la présence de prix Cardmarket");
    const raw = JSON.stringify(catalog);
    assert.ok(!/@example\.com|passwordHash|tokenHash/.test(raw), "le catalogue public ne contient aucune donnée de compte");
  });

  it("GET /api/catalog : cache CDN public et même contenu que loadCatalog", async () => {
    const response = await catalogRoute();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "public, s-maxage=300, stale-while-revalidate=3600");
    assert.equal(response.headers.getSetCookie().length, 0, "une réponse mise en cache ne pose aucun cookie");
    const body = await json<Awaited<ReturnType<typeof loadCatalog>>>(response);
    const direct = await loadCatalog();
    assert.equal(body.printings.length, direct.printings.length);
    assert.equal(body.cards.length, direct.cards.length);
  });
});

describe.sequential("session et déconnexion", () => {
  let account: Awaited<ReturnType<typeof makeAccount>>;

  beforeAll(async () => {
    account = await makeAccount("session");
  });

  it("sans cookie ou avec un cookie inventé : 401 et cookie effacé", async () => {
    for (const session of [null, "jeton-invente", "%E0%A4%A"]) {
      const response = await sessionRoute(request("/api/auth/session", session));
      assert.equal(response.status, 401);
      assert.deepEqual(await json(response), { user: null });
      const line = sessionCookieLine(response);
      assert.ok(line, "le cookie est effacé");
      assert.match(line, /Max-Age=0/i);
      assert.match(line, new RegExp(`^${SESSION_COOKIE}=;`));
    }
  });

  it("session valide : utilisateur public seulement, cookie et expiration prolongés", async () => {
    await prisma.session.updateMany({
      where: { userId: account.id },
      data: { expiresAt: new Date(Date.now() + 60_000) },
    });
    const response = await sessionRoute(request("/api/auth/session", account.token));
    assert.equal(response.status, 200);
    const body = await json<{ user: Record<string, unknown> }>(response);
    assert.deepEqual(body.user, { id: account.id, email: account.email, displayName: "Routes session" });
    const line = sessionCookieLine(response);
    assert.ok(line);
    assert.match(line, new RegExp(`Max-Age=${SESSION_MAX_AGE_SECONDS}`));
    assert.match(line, /HttpOnly/i);
    const stored = await prisma.session.findFirstOrThrow({ where: { userId: account.id } });
    assert.ok(stored.expiresAt.getTime() > Date.now() + (SESSION_MAX_AGE_SECONDS - 60) * 1000, "expiration prolongée");
  });

  it("session expirée : 401 et ligne de session supprimée", async () => {
    const extra = await createSession(account.id);
    const tokenHash = createHash("sha256").update(extra.token).digest("hex");
    await prisma.session.update({ where: { tokenHash }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const response = await sessionRoute(request("/api/auth/session", extra.token));
    assert.equal(response.status, 401);
    assert.match(sessionCookieLine(response) ?? "", /Max-Age=0/i);
    assert.equal(await prisma.session.findUnique({ where: { tokenHash } }), null, "la session expirée est supprimée");
    assert.equal(
      (await sessionRoute(request("/api/auth/session", account.token))).status,
      200,
      "les autres sessions restent valides",
    );
  });

  it("utilisateur sans e-mail (anonyme) : la session est refusée", async () => {
    const anonymous = await prisma.user.create({ data: { displayName: "Anonyme" } });
    createdUserIds.push(anonymous.id);
    const session = await createSession(anonymous.id);
    const response = await sessionRoute(request("/api/auth/session", session.token));
    assert.equal(response.status, 401);
    assert.equal(await prisma.session.count({ where: { userId: anonymous.id } }), 0);
  });

  it("déconnexion : cookie effacé, session supprimée, sans effet sur les autres sessions", async () => {
    const other = await createSession(account.id);
    const response = await logoutRoute(request("/api/auth/logout", account.token, { method: "POST" }));
    assert.equal(response.status, 200);
    assert.deepEqual(await json(response), { ok: true });
    const line = sessionCookieLine(response);
    assert.ok(line);
    assert.match(line, /Max-Age=0/i);
    assert.equal((await sessionRoute(request("/api/auth/session", account.token))).status, 401);
    assert.equal((await sessionRoute(request("/api/auth/session", other.token))).status, 200, "l'autre appareil reste connecté");
  });

  it("déconnexion sans cookie ou avec un jeton inconnu : réponse ok, rien supprimé", async () => {
    const before = await prisma.session.count();
    for (const session of [null, "jeton-invente"]) {
      const response = await logoutRoute(request("/api/auth/logout", session, { method: "POST" }));
      assert.equal(response.status, 200);
      assert.match(sessionCookieLine(response) ?? "", /Max-Age=0/i);
    }
    assert.equal(await prisma.session.count(), before);
  });
});

describe.sequential("statistiques", () => {
  let account: Awaited<ReturnType<typeof makeAccount>>;

  beforeAll(async () => {
    account = await makeAccount("stats");
  });

  it("exige une session", async () => {
    assert.equal((await statsRoute(request("/api/stats", null))).status, 401);
  });

  it("forme de la réponse, portée en/fr et montant dépensé", async () => {
    const empty = await json<Stats>(await statsRoute(request("/api/stats", account.token)));
    assert.equal(empty.scope, "en");
    assert.deepEqual(empty.spent, { totals: [], pricedLines: 0 });
    for (const scope of ["fr", "FR", "zz", ""]) {
      const body = await json<Stats>(await statsRoute(request(`/api/stats?scope=${scope}`, account.token)));
      assert.equal(body.scope, scope === "fr" ? "fr" : "en", `scope=${scope}`);
    }

    const printings = await prisma.printing.findMany({ where: { isActive: true }, take: 2, select: { id: true } });
    const condition = await prisma.condition.findFirstOrThrow({ orderBy: { sortOrder: "asc" } });
    await prisma.collectionItem.createMany({
      data: [
        { userId: account.id, printingId: printings[0].id, conditionId: condition.id, quantity: 3, purchasePrice: "2.50", purchaseCurrency: "EUR" },
        { userId: account.id, printingId: printings[1].id, conditionId: condition.id, quantity: 2, purchasePrice: "4", purchaseCurrency: "USD" },
      ],
    });
    const body = await json<Stats>(await statsRoute(request("/api/stats", account.token)));
    assert.equal(body.spent.pricedLines, 2);
    assert.deepEqual(new Map(body.spent.totals), new Map([["EUR", 7.5], ["USD", 8]]), "dépense par devise × quantité");
    for (const key of ["progress", "english", "french", "rarities", "hasPrices", "mainSetCode"]) {
      assert.ok(key in body, `champ ${key}`);
    }
  });
});

describe.sequential("historique de prix", () => {
  let account: Awaited<ReturnType<typeof makeAccount>>;

  beforeAll(async () => {
    account = await makeAccount("historique");
  });

  it("exige une session", async () => {
    assert.equal((await historyRoute(request("/api/investment/history", null))).status, 401);
    assert.equal((await historyRoute(request("/api/investment/history?printingId=x", "jeton-invente"))).status, 401);
  });

  it("carte inexistante : historique vide, sans erreur", async () => {
    for (const printingId of [`inconnue-${stamp}`, "'; DROP TABLE Price; --", "x".repeat(500)]) {
      const response = await historyRoute(
        request(`/api/investment/history?printingId=${encodeURIComponent(printingId)}`, account.token),
      );
      assert.equal(response.status, 200);
      const body = await json<{ kind: string; printingId: string; points: unknown[] }>(response);
      assert.equal(body.kind, "printing");
      assert.equal(body.printingId, printingId);
      assert.deepEqual(body.points, []);
    }
  });

  it("jour de référence invalide ignoré ; collection vide = aucun prix", async () => {
    for (const day of ["", "hier", "2024-13-45x", "2024-1-1"]) {
      const response = await historyRoute(
        request(`/api/investment/history?referenceDay=${encodeURIComponent(day)}`, account.token),
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await json(response), { kind: "reference", day: null, prices: {} });
    }
    const valid = await json<{ day: string | null }>(
      await historyRoute(request("/api/investment/history?referenceDay=2024-01-01", account.token)),
    );
    assert.equal(valid.day, "2024-01-01");
  });

  it("courbe du portefeuille : filtres par défaut et inconnus", async () => {
    const all = await json<{ kind: string; set: string; language: string; points: unknown[] }>(
      await historyRoute(request("/api/investment/history", account.token)),
    );
    assert.equal(all.kind, "portfolio");
    assert.equal(all.set, "all");
    assert.equal(all.language, "");
    assert.deepEqual(all.points, []);
    const filtered = await json<{ set: string; language: string; points: unknown[] }>(
      await historyRoute(request(`/api/investment/history?set=inconnu-${stamp}&language=xx`, account.token)),
    );
    assert.equal(filtered.set, `inconnu-${stamp}`);
    assert.equal(filtered.language, "xx");
    assert.deepEqual(filtered.points, []);
  });
});
