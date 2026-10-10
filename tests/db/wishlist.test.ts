/**
 * Liste de souhaits et alertes de prix : routes /api/wishlist, isolation entre comptes,
 * déclenchement / effacement des alertes après l'import quotidien des prix.
 * Travaille sur une COPIE de la base SQLite (tests/helpers/db-copy.ts) : l'évaluation des alertes
 * parcourt toutes les listes de souhaits et les prix sont modifiés, la vraie base n'est donc jamais ouverte.
 */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, it } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";
import type { WishlistItemDTO } from "../../src/lib/types";

type Prisma = typeof import("../../src/lib/prisma").prisma;
type Routes = {
  list: typeof import("../../src/app/api/wishlist/route");
  item: typeof import("../../src/app/api/wishlist/[id]/route");
  seen: typeof import("../../src/app/api/wishlist/seen/route");
};

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const BASE_ID = 881_000_000;
const SET_NAME = `Wishlist Fixture ${stamp}`;
const NAMES = ["Wish Alpha", "Wish Bravo"];

let db: Awaited<ReturnType<typeof openDatabaseCopy>> | null = null;
let prisma: Prisma;
let routes: Routes;
let evaluateWishlistAlerts: typeof import("../../src/lib/wishlist").evaluateWishlistAlerts;
let importPrices: typeof import("../../src/lib/price-import").importPrices;
let sessionCookie: string;
let filesDir: string;
let sourceId: string;
const userIds: string[] = [];
const P: string[] = [];
let owner: { token: string };
let other: { token: string };

function request(url: string, token: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (token) headers.set("cookie", `${sessionCookie}=${encodeURIComponent(token)}`);
  return new Request(`http://127.0.0.1${url}`, { ...init, headers });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

async function add(token: string, body: unknown) {
  const response = await routes.list.POST(request("/api/wishlist", token, { method: "POST", body: JSON.stringify(body) }));
  return { status: response.status, body: (await response.json()) as { item?: WishlistItemDTO; error?: string } };
}

async function list(token: string) {
  const response = await routes.list.GET(request("/api/wishlist", token));
  assert.equal(response.status, 200);
  return ((await response.json()) as { items: WishlistItemDTO[] }).items;
}

async function setPrice(printingId: string, amount: number) {
  await prisma.price.deleteMany({ where: { printingId } });
  await prisma.price.create({ data: { printingId, sourceId, kind: "trend", amount: amount.toFixed(2), currency: "EUR" } });
}

let guideClock = Date.parse("2026-02-01T00:00:00Z");
let fileCount = 0;

/** Import du guide de prix depuis des fixtures (sans réseau), comme le cron quotidien. */
async function runImport(amounts: number[]) {
  fileCount += 1;
  const products = path.join(filesDir, `products-${fileCount}.json`);
  const prices = path.join(filesDir, `guide-${fileCount}.json`);
  writeFileSync(
    products,
    JSON.stringify({
      version: 1,
      products: NAMES.map((name, index) => ({
        idProduct: BASE_ID + index + 1,
        name,
        expansionName: SET_NAME,
        number: String(index + 1).padStart(3, "0"),
      })),
    }),
  );
  writeFileSync(
    prices,
    JSON.stringify({
      version: 1,
      createdAt: new Date((guideClock += 3_600_000)).toISOString(),
      priceGuides: amounts.map((trend, index) => ({ idProduct: BASE_ID + index + 1, trend, low: 0, avg: 0 })),
    }),
  );
  const result = await importPrices(prisma, {
    cacheDir: filesDir,
    files: { products, prices, nonsingles: null },
    log: () => undefined,
  });
  assert.equal(result.status, "imported");
  return (result as unknown as { report: { wishlistAlerts: { checked: number; triggered: number; cleared: number } } }).report;
}

beforeAll(async () => {
  db = await openDatabaseCopy("cptcg-wishlist-");
  prisma = db.prisma;
  filesDir = mkdtempSync(path.join(db.tmpDir, "files-"));
  routes = {
    list: await import("../../src/app/api/wishlist/route"),
    item: await import("../../src/app/api/wishlist/[id]/route"),
    seen: await import("../../src/app/api/wishlist/seen/route"),
  };
  ({ evaluateWishlistAlerts } = await import("../../src/lib/wishlist"));
  ({ importPrices } = await import("../../src/lib/price-import"));
  const auth = await import("../../src/lib/auth");
  sessionCookie = auth.SESSION_COOKIE;

  // Copie seulement : catalogue existant hors jeu, prix et souhaits repartis de zéro.
  await prisma.printing.updateMany({ data: { isActive: false } });
  await prisma.wishlistItem.deleteMany({});
  await prisma.priceSnapshot.deleteMany({});
  await prisma.price.deleteMany({});
  sourceId = (
    await prisma.priceSource.upsert({
      where: { code: "cardmarket" },
      update: { guideCreatedAt: null },
      create: { code: "cardmarket", name: "Cardmarket" },
    })
  ).id;
  const set = await prisma.set.create({ data: { code: `wl-fixture-${stamp}`, name: SET_NAME, cardCount: NAMES.length } });
  for (const [index, name] of NAMES.entries()) {
    const id = `wl-${stamp}-${index + 1}`;
    const card = await prisma.card.create({
      data: { externalId: id, code: id, slug: id, name, displayName: name, canonicalName: name },
    });
    const printing = await prisma.printing.create({
      data: {
        externalId: `${id}-p`,
        cardId: card.id,
        setId: set.id,
        collectorNumber: String(index + 1).padStart(3, "0"),
        language: "en",
      },
    });
    P.push(printing.id);
  }

  const makeAccount = async (label: string) => {
    const user = await auth.registerAccount({
      email: `wishlist.${label}.${stamp}@example.com`,
      password: "motdepasse-robuste",
      displayName: `Souhaits ${label}`,
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

describe.sequential("liste de souhaits et alertes de prix (copie)", () => {
  it("refuse les requêtes sans session et les entrées invalides", async () => {
    assert.equal((await routes.list.GET(request("/api/wishlist", null))).status, 401);
    assert.equal((await add(owner.token, { printingId: P[0], targetPrice: "abc" })).status, 400);
    assert.equal((await add(owner.token, { printingId: P[0], targetPrice: -1 })).status, 400);
    assert.equal((await add(owner.token, { printingId: "inconnu" })).status, 400);
  });

  it("ajout : cible au-dessus du prix actuel = alerte déjà vue, sinon pas d'alerte", async () => {
    await setPrice(P[0], 10);
    await setPrice(P[1], 20);
    const reached = await add(owner.token, { printingId: P[0], targetPrice: "12,5" });
    assert.equal(reached.status, 200);
    assert.equal(reached.body.item?.targetPrice, "12.50");
    assert.ok(reached.body.item?.alertAt);
    assert.equal(reached.body.item?.alertPrice, "10.00");
    assert.equal(reached.body.item?.alertSeen, true);

    const waiting = await add(owner.token, { printingId: P[1], targetPrice: 15 });
    assert.equal(waiting.body.item?.alertAt, null);

    // Ré-ajouter la même carte met à jour la ligne existante.
    const again = await add(owner.token, { printingId: P[1], targetPrice: 14 });
    assert.equal(again.body.item?.id, waiting.body.item?.id);
    assert.equal((await list(owner.token)).length, 2);
  });

  it("isolation : un autre compte ne voit ni ne modifie la liste", async () => {
    assert.deepEqual(await list(other.token), []);
    const [item] = await list(owner.token);
    const patch = await routes.item.PATCH(
      request(`/api/wishlist/${item.id}`, other.token, { method: "PATCH", body: JSON.stringify({ targetPrice: 1 }) }),
      params(item.id),
    );
    assert.equal(patch.status, 404);
    const removed = await routes.item.DELETE(request(`/api/wishlist/${item.id}`, other.token, { method: "DELETE" }), params(item.id));
    assert.deepEqual(await removed.json(), { deletedId: null });
    assert.equal((await list(owner.token)).length, 2);
  });

  it("import des prix : baisse sous la cible = nouvelle alerte, remontée = alerte effacée", async () => {
    let report = await runImport([10, 13]);
    assert.deepEqual(report.wishlistAlerts, { checked: 2, triggered: 1, cleared: 0 });
    let items = await list(owner.token);
    let bravo = items.find((item) => item.printingId === P[1])!;
    assert.equal(bravo.alertPrice, "13.00");
    assert.equal(bravo.alertSeen, false);

    // Toujours sous la cible : pas de nouvelle alerte, le prix suivi est mis à jour.
    report = await runImport([10, 12]);
    assert.deepEqual(report.wishlistAlerts, { checked: 2, triggered: 0, cleared: 0 });
    bravo = (await list(owner.token)).find((item) => item.printingId === P[1])!;
    assert.equal(bravo.alertPrice, "12.00");
    assert.equal(bravo.alertSeen, false);

    const seen = await routes.seen.POST(request("/api/wishlist/seen", owner.token, { method: "POST" }));
    assert.equal(seen.status, 200);
    assert.ok((await list(owner.token)).every((item) => item.alertSeen));

    report = await runImport([30, 12]);
    assert.deepEqual(report.wishlistAlerts, { checked: 2, triggered: 0, cleared: 1 });
    items = await list(owner.token);
    const alpha = items.find((item) => item.printingId === P[0])!;
    assert.equal(alpha.alertAt, null);
    assert.equal(alpha.alertPrice, null);

    // Nouvelle baisse : nouvelle alerte.
    report = await runImport([11, 12]);
    assert.equal(report.wishlistAlerts.triggered, 1);
  });

  it("modifier ou effacer la cible recalcule l'alerte ; une carte sans cible n'est pas évaluée", async () => {
    const alpha = (await list(owner.token)).find((item) => item.printingId === P[0])!;
    const patch = await routes.item.PATCH(
      request(`/api/wishlist/${alpha.id}`, owner.token, { method: "PATCH", body: JSON.stringify({ targetPrice: "" }) }),
      params(alpha.id),
    );
    const { item } = (await patch.json()) as { item: WishlistItemDTO };
    assert.equal(item.targetPrice, null);
    assert.equal(item.alertAt, null);
    assert.equal(item.alertSeen, true);
    assert.deepEqual(await evaluateWishlistAlerts(prisma), { checked: 1, triggered: 0, cleared: 0 });
  });

  it("suppression, puis cascade à la suppression du tirage", async () => {
    const [first, second] = await list(owner.token);
    const removed = await routes.item.DELETE(request(`/api/wishlist/${first.id}`, owner.token, { method: "DELETE" }), params(first.id));
    assert.deepEqual(await removed.json(), { deletedId: first.id });
    await prisma.price.deleteMany({ where: { printingId: second.printingId } });
    await prisma.priceSnapshot.deleteMany({ where: { printingId: second.printingId } });
    await prisma.printing.delete({ where: { id: second.printingId } });
    assert.deepEqual(await list(owner.token), []);
  });
});
