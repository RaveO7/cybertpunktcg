import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { aggregateCollection, defaultFilters, filterPrintings } from "../../src/lib/logic";
import { ALL_SETS_ID } from "../../src/lib/reference-data";
import { cardsWithExtras, tradeList } from "../../src/lib/trades";
import type { CardDTO, CollectionItemDTO, PrintingDTO } from "../../src/lib/types";

function card(id: string, cardType = "Unit"): CardDTO {
  return {
    id,
    externalId: id,
    slug: id,
    name: id,
    subname: null,
    canonicalName: id,
    rulesText: null,
    flavorText: null,
    color: "Red",
    cardType,
    isEddiable: null,
    cost: 2,
    power: 2,
    ram: 1,
    legality: "legal",
    tags: [],
    keywords: [],
  };
}

function printing(id: string, cardId: string, language: string, marketPrice: string | null): PrintingDTO {
  return {
    id,
    cardId,
    externalId: id,
    setCode: "set",
    setName: "Set",
    collectorNumber: "001",
    rarity: null,
    language,
    localizedName: null,
    imagePath: null,
    artist: null,
    printedRulesText: null,
    officialFinish: null,
    marketPrice,
    previousMarketPrice: null,
  };
}

function item(printingId: string, quantity: number, conditionCode = "NM"): CollectionItemDTO {
  return {
    id: `${printingId}-${conditionCode}`,
    printingId,
    conditionCode,
    conditionName: conditionCode,
    quantity,
    notes: null,
    purchasePrice: null,
    purchaseCurrency: null,
    addedAt: "2026-01-01T00:00:00.000Z",
  };
}

const cards = [card("unit"), card("legend", "Legend"), card("exact"), card("box", "Sealed"), card("free")];
const cardsById = new Map(cards.map((entry) => [entry.id, entry]));
const printings = [
  printing("unit-en", "unit", "en", "2.00"),
  printing("unit-fr", "unit", "fr", "0.50"),
  printing("legend-en", "legend", "en", null),
  printing("exact-en", "exact", "en", "1.00"),
  printing("box-en", "box", "en", "90.00"),
  printing("free-en", "free", "en", "1.00"),
];
// unit : 3 EN (2 états) + 2 FR = 5 → 2 en trop ; legend : 2 → 1 en trop ; exact : 3 → 0 ; scellé ignoré.
const items = [
  item("unit-en", 2),
  item("unit-en", 1, "EX"),
  item("unit-fr", 2),
  item("legend-en", 2),
  item("exact-en", 3),
  item("box-en", 6),
];
const agg = aggregateCollection(items);

describe("trades : exemplaires en trop", () => {
  it("compte tous les tirages d'une carte et applique la limite (3, Legend 1)", () => {
    const list = tradeList(printings, cardsById, agg);
    assert.deepEqual(
      list.lines.map((line) => [line.card.id, line.owned, line.limit, line.extra]),
      [
        ["unit", 5, 3, 2],
        ["legend", 2, 1, 1],
      ],
    );
    assert.equal(list.extraCopies, 3);
    assert.deepEqual(
      list.lines[0].printings.map((entry) => [entry.printing.id, entry.quantity]),
      [
        ["unit-en", 3],
        ["unit-fr", 2],
      ],
    );
  });

  it("valorise au tirage possédé le moins cher, sans prix → exemplaires non cotés", () => {
    const list = tradeList(printings, cardsById, agg);
    assert.equal(list.lines[0].unitPrice, 0.5);
    assert.equal(list.lines[0].value, 1);
    assert.equal(list.lines[1].value, null);
    assert.equal(list.value, 1);
    assert.equal(list.unpricedCopies, 1);
  });

  it("collection vide ou dans les limites : aucune ligne", () => {
    assert.deepEqual(tradeList(printings, cardsById, aggregateCollection([])).lines, []);
    assert.deepEqual(tradeList(printings, cardsById, aggregateCollection([item("exact-en", 3)])).lines, []);
  });

  it("filtre « extras » : tirages possédés des cartes en trop seulement", () => {
    const extras = cardsWithExtras(printings, cardsById, agg);
    assert.deepEqual([...extras].sort(), ["legend", "unit"]);
    const filters = { ...defaultFilters(false), set: ALL_SETS_ID, collection: "extras" as const };
    const matched = filterPrintings(printings, cardsById, agg, filters, null, extras);
    assert.deepEqual(matched.map((entry) => entry.id).sort(), ["legend-en", "unit-en", "unit-fr"]);
    // Sans l'ensemble des cartes en trop, le filtre ne retient rien.
    assert.deepEqual(filterPrintings(printings, cardsById, agg, filters, null), []);
  });
});
