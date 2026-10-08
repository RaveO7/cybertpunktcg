import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { loadCatalog, loadCollection } from "../../src/lib/catalog";
import { deleteCollectionLine, saveCollectionLine } from "../../src/lib/collection-mutate";
import { aggregateCollection, computeProgress, defaultFilters, filterPrintings } from "../../src/lib/logic";
import { prisma } from "../../src/lib/prisma";
import { MAIN_SET_CODE } from "../../src/lib/reference-data";
import { assertFullCatalog } from "../helpers/catalog";

const userId = `verifyuser-${Date.now().toString(36)}`;

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.$disconnect();
});

// Invariants du vrai catalogue (import local, ou instantané tests/fixtures chargé en CI).
describe("catalogue importé", () => {
  beforeAll(assertFullCatalog);

  it("les prix Cardmarket correspondent au catalogue", async () => {
    const catalog = await loadCatalog();
    const prices = await prisma.price.findMany({ include: { source: true } });
    for (const price of prices) {
      assert.equal(price.source.code, "cardmarket");
      assert.equal(price.kind, "trend");
      assert.ok(Number(price.amount) > 0);
      const printing = catalog.printings.find((item) => item.id === price.printingId);
      assert.equal(Number(printing?.marketPrice), Number(price.amount));
    }
    assert.equal(catalog.hasPrices, prices.length > 0);
    assert.ok(catalog.cards.length >= 140);
    assert.ok(catalog.printings.length >= 600);
  });

  it("aucun prix cloné vers le FR ni les retail sans marché propre", async () => {
    const catalog = await loadCatalog();
    const frLeaks = catalog.printings.filter(
      (printing) => printing.setCode.endsWith("-fr") && printing.marketPrice != null,
    );
    // FR printings only get prices from a dedicated match, never from EN cloning.
    // Currently Cardmarket singles have no FR expansion mapping, so FR should be unpriced.
    assert.equal(frLeaks.length, 0, "French printings must not inherit English Cardmarket prices");
    const boxRetailPriced = catalog.printings.filter(
      (printing) => printing.setCode === "boxtoppersretail" && printing.marketPrice != null,
    );
    assert.equal(boxRetailPriced.length, 0, "box toppers retail must stay unpriced with current CM data");
    const welcomeRetailPriced = catalog.printings.filter(
      (printing) => printing.setCode === "welcometonightcityretail" && printing.marketPrice != null,
    );
    assert.equal(
      welcomeRetailPriced.length,
      0,
      "welcome retail must stay unpriced while Cardmarket only lists the beta expansion",
    );
    const finishes = new Set(catalog.printings.map((printing) => printing.officialFinish).filter(Boolean));
    assert.equal(finishes.size, 0);
  });

  it("enregistre, compte et filtre une collection réelle", async () => {
    await prisma.user.create({ data: { id: userId, displayName: "Vérification" } });
    const catalog = await loadCatalog();
    const streetkid = catalog.cards.find((card) => card.externalId === "81a8dec7-9541-4020-93e1-7d798a57dcbc");
    assert.ok(streetkid);
    assert.equal(streetkid.canonicalName, "V — Streetkid");

    const retail = catalog.printings.filter(
      (printing) => printing.setCode === MAIN_SET_CODE && printing.language === "en",
    );
    assert.ok(retail.length > 100);
    const target = retail.find((printing) => printing.cardId === streetkid.id);
    assert.ok(target);
    await saveCollectionLine(userId, { printingId: target.id, conditionCode: "NM", quantity: 5, mode: "set" });
    await saveCollectionLine(userId, { printingId: target.id, conditionCode: "LP", quantity: 1, mode: "add" });

    const items = await loadCollection(userId);
    const agg = aggregateCollection(items);
    const one = computeProgress([target], agg);
    assert.equal(one.uniqueOwned, 1);
    assert.equal(one.totalCopies, 6);
    assert.equal(one.duplicates, 1);
    assert.equal(one.missing, 0);

    const main = computeProgress(retail, agg);
    assert.equal(main.uniqueOwned, 1);
    assert.equal(main.missing, retail.length - 1);
    assert.equal(main.totalCopies, 6);

    const cards = new Map(catalog.cards.map((card) => [card.id, card]));
    const missing = filterPrintings(retail, cards, agg, { ...defaultFilters(), set: MAIN_SET_CODE, collection: "missing" });
    assert.equal(missing.length, retail.length - 1);
    assert.equal(missing.some((printing) => printing.id === target.id), false);

    const owned = filterPrintings(retail, cards, agg, {
      ...defaultFilters(),
      set: MAIN_SET_CODE,
      language: "en",
      collection: "owned",
      condition: "LP",
    });
    assert.deepEqual(owned.map((printing) => printing.id), [target.id]);

    for (const item of items) await deleteCollectionLine(userId, item.id);
    assert.equal((await loadCollection(userId)).length, 0);
  });
});
