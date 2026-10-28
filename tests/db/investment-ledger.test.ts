/**
 * Ventes, alertes de revente et taux de change de la page Investissement : routes /api/investment/sales,
 * /api/investment/sell-alerts et /api/investment/rates, isolation entre comptes, évaluation des alertes.
 * Travaille sur une COPIE de la base SQLite (tests/helpers/db-copy.ts) : l'évaluation des alertes parcourt
 * toutes les alertes et les prix sont modifiés, la vraie base n'est donc jamais ouverte.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { openDatabaseCopy } from "../helpers/db-copy";
import type { CollectionItemDTO, SaleDTO, SellAlertDTO } from "../../src/lib/types";

type Prisma = typeof import("../../src/lib/prisma").prisma;
type Routes = {
  sales: typeof import("../../src/app/api/investment/sales/route");
  sale: typeof import("../../src/app/api/investment/sales/[id]/route");
  alerts: typeof import("../../src/app/api/investment/sell-alerts/route");
  alert: typeof import("../../src/app/api/investment/sell-alerts/[id]/route");
  seen: typeof import("../../src/app/api/investment/sell-alerts/seen/route");
  rates: typeof import("../../src/app/api/investment/rates/route");
};

const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

let db: Awaited<ReturnType<typeof openDatabaseCopy>> | null = null;
let prisma: Prisma;
let routes: Routes;
let evaluateSellAlerts: typeof import("../../src/lib/sell-alerts").evaluateSellAlerts;
let loadPortfolioPriceHistory: typeof import("../../src/lib/investment-history").loadPortfolioPriceHistory;
let sessionCookie: string;
let sourceId: string;
let conditionId: string;
const userIds: string[] = [];
const P: string[] = [];
let owner: { id: string; token: string };
let other: { id: string; token: string };

function request(url: string, token: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("content-type", "application/json");
  if (token) headers.set("cookie", `${sessionCookie}=${encodeURIComponent(token)}`);
  return new Request(`http://127.0.0.1${url}`, { ...init, headers });
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

type SellBody = { sale?: SaleDTO; item?: CollectionItemDTO | null; deletedId?: string | null; error?: string };

async function sell(token: string, body: unknown) {
  const response = await routes.sales.POST(request("/api/investment/sales", token, { method: "POST", body: JSON.stringify(body) }));
  return { status: response.status, body: (await response.json()) as SellBody };
}

async function listSales(token: string) {
  const response = await routes.sales.GET(request("/api/investment/sales", token));
  assert.equal(response.status, 200);
  return ((await response.json()) as { sales: SaleDTO[] }).sales;
}

async function saveAlert(token: string, body: unknown) {
  const response = await routes.alerts.POST(request("/api/investment/sell-alerts", token, { method: "POST", body: JSON.stringify(body) }));
  return { status: response.status, body: (await response.json()) as { alert?: SellAlertDTO; error?: string } };
}

async function listAlerts(token: string) {
  const response = await routes.alerts.GET(request("/api/investment/sell-alerts", token));
  assert.equal(response.status, 200);
  return ((await response.json()) as { alerts: SellAlertDTO[] }).alerts;
}

async function setPrice(printingId: string, amount: number) {
  await prisma.price.deleteMany({ where: { printingId } });
  await prisma.price.create({ data: { printingId, sourceId, kind: "trend", amount: amount.toFixed(2), currency: "EUR" } });
}

async function addLine(userId: string, printingId: string, data: { quantity: number; purchasePrice?: string; purchaseCurrency?: string; purchasedAt?: string }) {
  return prisma.collectionItem.create({
    data: {
      userId,
      printingId,
      conditionId,
      quantity: data.quantity,
      purchasePrice: data.purchasePrice ?? null,
      purchaseCurrency: data.purchasePrice ? (data.purchaseCurrency ?? "EUR") : null,
      purchasedAt: data.purchasedAt ? new Date(`${data.purchasedAt}T00:00:00.000Z`) : null,
    },
  });
}

beforeAll(async () => {
  db = await openDatabaseCopy("cptcg-ledger-");
  prisma = db.prisma;
  routes = {
    sales: await import("../../src/app/api/investment/sales/route"),
    sale: await import("../../src/app/api/investment/sales/[id]/route"),
    alerts: await import("../../src/app/api/investment/sell-alerts/route"),
    alert: await import("../../src/app/api/investment/sell-alerts/[id]/route"),
    seen: await import("../../src/app/api/investment/sell-alerts/seen/route"),
    rates: await import("../../src/app/api/investment/rates/route"),
  };
  ({ evaluateSellAlerts } = await import("../../src/lib/sell-alerts"));
  ({ loadPortfolioPriceHistory } = await import("../../src/lib/investment-history"));
  const auth = await import("../../src/lib/auth");
  sessionCookie = auth.SESSION_COOKIE;

  // Copie seulement : alertes et taux repartis de zéro.
  await prisma.sellAlert.deleteMany({});
  await prisma.exchangeRate.deleteMany({});
  sourceId = (
    await prisma.priceSource.upsert({
      where: { code: "cardmarket" },
      update: {},
      create: { code: "cardmarket", name: "Cardmarket" },
    })
  ).id;
  conditionId = (await prisma.condition.upsert({ where: { code: "NM" }, update: {}, create: { code: "NM", name: "Near Mint", sortOrder: 0 } })).id;
  const set = await prisma.set.create({ data: { code: `ledger-fixture-${stamp}`, name: `Ledger ${stamp}`, cardCount: 2 } });
  for (const [index, name] of ["Ledger Alpha", "Ledger Bravo"].entries()) {
    const id = `ledger-${stamp}-${index + 1}`;
    const card = await prisma.card.create({ data: { externalId: id, code: id, slug: id, name, displayName: name, canonicalName: name } });
    const printing = await prisma.printing.create({
      data: { externalId: `${id}-p`, cardId: card.id, setId: set.id, collectorNumber: String(index + 1).padStart(3, "0"), language: "en" },
    });
    P.push(printing.id);
  }

  const makeAccount = async (label: string) => {
    const user = await auth.registerAccount({
      email: `ledger.${label}.${stamp}@example.com`,
      password: "motdepasse-robuste",
      displayName: `Ventes ${label}`,
    });
    userIds.push(user.id);
    return { id: user.id, token: (await auth.createSession(user.id)).token };
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

describe.sequential("ventes, alertes de revente et taux de change (copie)", () => {
  it("vente : refus sans session, quantité ou date invalide, ligne d'un autre compte", async () => {
    const line = await addLine(owner.id, P[0], { quantity: 3, purchasePrice: "4.00", purchasedAt: "2026-02-01" });
    assert.equal((await routes.sales.GET(request("/api/investment/sales", null))).status, 401);
    const base = { itemId: line.id, salePrice: "10", soldAt: "2026-03-01" };
    assert.equal((await sell(owner.token, { ...base, quantity: 4 })).status, 400);
    assert.equal((await sell(owner.token, { ...base, quantity: 0 })).status, 400);
    assert.equal((await sell(owner.token, { ...base, quantity: 1, salePrice: "" })).status, 400);
    assert.equal((await sell(owner.token, { ...base, quantity: 1, soldAt: "2026-01-15" })).status, 400, "vente avant l'achat");
    assert.equal((await sell(other.token, { ...base, quantity: 1 })).status, 404);
    assert.equal((await prisma.collectionItem.findUniqueOrThrow({ where: { id: line.id } })).quantity, 3);
  });

  it("vente partielle puis totale : la ligne diminue puis disparaît, la vente garde le prix de revient", async () => {
    const line = await prisma.collectionItem.findFirstOrThrow({ where: { userId: owner.id, printingId: P[0] } });
    const partial = await sell(owner.token, { itemId: line.id, quantity: 2, salePrice: "25,50", fees: "1.5", soldAt: "2026-03-01" });
    assert.equal(partial.status, 200);
    assert.equal(partial.body.item?.quantity, 1);
    assert.equal(partial.body.deletedId, null);
    assert.deepEqual(
      [partial.body.sale?.quantity, partial.body.sale?.salePrice, partial.body.sale?.fees, partial.body.sale?.purchasePrice],
      [2, "25.50", "1.50", "4.00"],
    );
    assert.equal(partial.body.sale?.purchasedAt, "2026-02-01");

    const rest = await sell(owner.token, { itemId: line.id, quantity: 1, salePrice: "12", saleCurrency: "USD", soldAt: "2026-03-05" });
    assert.equal(rest.status, 200);
    assert.equal(rest.body.item, null);
    assert.equal(rest.body.deletedId, line.id);
    assert.equal(await prisma.collectionItem.count({ where: { id: line.id } }), 0);

    const sales = await listSales(owner.token);
    assert.deepEqual(sales.map((entry) => entry.soldAt), ["2026-03-05", "2026-03-01"]);
    assert.deepEqual(await listSales(other.token), []);
  });

  it("courbe : les exemplaires vendus comptent jusqu'au jour de la vente", async () => {
    for (const [day, amount] of [["2026-02-15", 10], ["2026-03-02", 10], ["2026-03-06", 10]] as const) {
      await prisma.priceSnapshot.create({
        data: { printingId: P[0], sourceId, kind: "trend", amount: String(amount), currency: "EUR", day: new Date(`${day}T00:00:00.000Z`) },
      });
    }
    const history = await loadPortfolioPriceHistory({ userId: owner.id, setCode: `ledger-fixture-${stamp}` });
    assert.deepEqual(
      history.points.map((point) => [point.day, point.marketTotal, point.invested]),
      [
        ["2026-02-15", 30, 12],
        ["2026-03-02", 10, 4],
      ],
      "le 2 mars, 2 exemplaires vendus ; le 6 mars, plus rien (le dernier vendu le 5)",
    );
  });

  it("correction et annulation : les exemplaires reviennent dans la ligne identique, ou une nouvelle ligne", async () => {
    const [last, first] = await listSales(owner.token);
    const patch = await routes.sale.PATCH(
      request(`/api/investment/sales/${first.id}`, owner.token, { method: "PATCH", body: JSON.stringify({ salePrice: "30", fees: "" }) }),
      params(first.id),
    );
    assert.equal(patch.status, 200);
    const patched = ((await patch.json()) as { sale: SaleDTO }).sale;
    assert.deepEqual([patched.salePrice, patched.fees, patched.soldAt], ["30.00", "0.00", "2026-03-01"]);
    const foreign = await routes.sale.PATCH(
      request(`/api/investment/sales/${first.id}`, other.token, { method: "PATCH", body: JSON.stringify({ salePrice: "1" }) }),
      params(first.id),
    );
    assert.equal(foreign.status, 404);
    const early = await routes.sale.PATCH(
      request(`/api/investment/sales/${first.id}`, owner.token, { method: "PATCH", body: JSON.stringify({ soldAt: "2026-01-01" }) }),
      params(first.id),
    );
    assert.equal(early.status, 400);

    // Ligne supprimée par la vente totale : l'annulation la recrée, puis la seconde annulation la complète.
    const undoLast = await routes.sale.DELETE(request(`/api/investment/sales/${last.id}`, owner.token, { method: "DELETE" }), params(last.id));
    assert.equal(undoLast.status, 200);
    const restored = ((await undoLast.json()) as { item: CollectionItemDTO }).item;
    assert.deepEqual([restored.quantity, restored.purchasePrice, restored.purchasedAt], [1, "4", "2026-02-01"]);
    const undoFirst = await routes.sale.DELETE(request(`/api/investment/sales/${first.id}`, owner.token, { method: "DELETE" }), params(first.id));
    const merged = ((await undoFirst.json()) as { item: CollectionItemDTO }).item;
    assert.equal(merged.id, restored.id);
    assert.equal(merged.quantity, 3);
    assert.deepEqual(await listSales(owner.token), []);
    const missing = await routes.sale.DELETE(request(`/api/investment/sales/${first.id}`, owner.token, { method: "DELETE" }), params(first.id));
    assert.equal(missing.status, 404);
  });

  it("alerte de revente : carte possédée seulement, cible atteinte = alerte déjà vue", async () => {
    await setPrice(P[0], 10);
    await setPrice(P[1], 10);
    assert.equal((await saveAlert(owner.token, { printingId: P[1], targetPrice: 20 })).status, 400, "carte non possédée");
    assert.equal((await saveAlert(owner.token, { printingId: P[0], targetPrice: 0 })).status, 400);
    const reached = await saveAlert(owner.token, { printingId: P[0], targetPrice: "9,5" });
    assert.equal(reached.status, 200);
    assert.equal(reached.body.alert?.targetPrice, "9.50");
    assert.ok(reached.body.alert?.alertAt);
    assert.equal(reached.body.alert?.alertSeen, true);
    const waiting = await saveAlert(owner.token, { printingId: P[0], targetPrice: 15 });
    assert.equal(waiting.body.alert?.id, reached.body.alert?.id, "une alerte par carte");
    assert.equal(waiting.body.alert?.alertAt, null);
    assert.deepEqual(await listAlerts(other.token), []);
  });

  it("évaluation après l'import des prix : hausse au-dessus de la cible, suivi, effacement, carte vendue", async () => {
    await setPrice(P[0], 16);
    let report = await evaluateSellAlerts(prisma);
    assert.deepEqual([report.checked, report.triggered, report.cleared], [1, 1, 0]);
    assert.deepEqual(report.triggeredItems, [{ userId: owner.id, printingId: P[0], price: 16 }]);
    let [alert] = await listAlerts(owner.token);
    assert.deepEqual([alert.alertPrice, alert.alertSeen], ["16.00", false]);

    await setPrice(P[0], 17);
    report = await evaluateSellAlerts(prisma);
    assert.deepEqual([report.triggered, report.cleared], [0, 0]);
    [alert] = await listAlerts(owner.token);
    assert.equal(alert.alertPrice, "17.00");

    const seen = await routes.seen.POST(request("/api/investment/sell-alerts/seen", owner.token, { method: "POST" }));
    assert.equal(seen.status, 200);
    assert.equal((await listAlerts(owner.token))[0].alertSeen, true);

    await setPrice(P[0], 12);
    report = await evaluateSellAlerts(prisma);
    assert.equal(report.cleared, 1);

    // Toutes les cartes vendues : plus d'alerte, même au-dessus de la cible.
    await setPrice(P[0], 30);
    await prisma.collectionItem.updateMany({ where: { userId: owner.id, printingId: P[0] }, data: { quantity: 0 } });
    report = await evaluateSellAlerts(prisma);
    assert.deepEqual([report.triggered, report.triggeredItems], [0, []]);

    const removed = await routes.alert.DELETE(
      request(`/api/investment/sell-alerts/${alert.id}`, other.token, { method: "DELETE" }),
      params(alert.id),
    );
    assert.deepEqual(await removed.json(), { deletedId: null });
    const own = await routes.alert.DELETE(request(`/api/investment/sell-alerts/${alert.id}`, owner.token, { method: "DELETE" }), params(alert.id));
    assert.deepEqual(await own.json(), { deletedId: alert.id });
  });

  it("taux de change : dernier taux publié au jour demandé ou avant, devises inconnues ignorées", async () => {
    await prisma.exchangeRate.createMany({
      data: [
        { currency: "USD", day: new Date("2026-01-02T00:00:00.000Z"), rate: "1.1" },
        { currency: "USD", day: new Date("2026-01-05T00:00:00.000Z"), rate: "1.2" },
        { currency: "GBP", day: new Date("2026-01-05T00:00:00.000Z"), rate: "0.8" },
      ],
    });
    const response = await routes.rates.POST(
      request("/api/investment/rates", owner.token, {
        method: "POST",
        body: JSON.stringify({ keys: ["USD:2026-01-04", "USD:2026-01-05", "USD:2025-12-01", "GBP:2026-02-01", "JPY:2026-01-05"] }),
      }),
    );
    assert.equal(response.status, 200);
    assert.deepEqual(((await response.json()) as { rates: Record<string, number> }).rates, {
      "USD:2026-01-04": 1.1,
      "USD:2026-01-05": 1.2,
      "USD:2025-12-01": 1.1,
      "GBP:2026-02-01": 0.8,
    });
    const invalid = await routes.rates.POST(
      request("/api/investment/rates", owner.token, { method: "POST", body: JSON.stringify({ keys: ["usd"] }) }),
    );
    assert.equal(invalid.status, 400);
    assert.equal((await routes.rates.POST(request("/api/investment/rates", null, { method: "POST", body: "{}" }))).status, 401);
  });
});
