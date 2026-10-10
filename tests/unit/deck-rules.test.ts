import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  analyzeDeck,
  cheapestPrinting,
  deckShortfall,
  deckToText,
  ownedCopiesByCard,
  parseDeckText,
  type DeckEntry,
} from "../../src/lib/deck-rules";
import type { CardDTO, CollectionItemDTO, PrintingDTO } from "../../src/lib/types";

function card(partial: Partial<CardDTO> & { id: string }): CardDTO {
  return {
    externalId: partial.id,
    slug: partial.id,
    name: partial.id,
    subname: null,
    canonicalName: partial.name ?? partial.id,
    rulesText: null,
    flavorText: null,
    color: "Red",
    cardType: "Unit",
    isEddiable: null,
    cost: 2,
    power: 2,
    ram: 1,
    legality: "legal",
    tags: [],
    keywords: [],
    ...partial,
  };
}

function printing(id: string, cardId: string, marketPrice: string | null): PrintingDTO {
  return {
    id,
    cardId,
    externalId: id,
    setCode: "set",
    setName: "Set",
    collectorNumber: "001",
    rarity: null,
    language: "en",
    localizedName: null,
    imagePath: null,
    artist: null,
    printedRulesText: null,
    officialFinish: null,
    marketPrice,
    previousMarketPrice: null,
  };
}

const legends = [
  card({ id: "goro", name: "Goro Takemura", subname: "Hands Unclean", cardType: "Legend", color: "Green", ram: 2 }),
  card({ id: "saburo", name: "Saburo Arasaka", cardType: "Legend", color: "Green", ram: 2 }),
  card({ id: "yorinobu", name: "Yorinobu Arasaka", cardType: "Legend", color: "Red", ram: 2 }),
  card({ id: "goro2", name: "Goro Takemura", subname: "Vengeful Bodyguard", cardType: "Legend", color: "Green", ram: 2 }),
];
// Cartes jouables : 13 Red RAM 1, une Green RAM 4, une Red RAM 3.
const units = Array.from({ length: 13 }, (_, index) => card({ id: `u${index}`, cost: index % 8 }));
const greenBig = card({ id: "green4", color: "Green", ram: 4, cost: 7 });
const redBig = card({ id: "red3", color: "Red", ram: 3, cost: 9 });
const banned = card({ id: "banned", legality: "not-legal" });
const sealed = card({ id: "box", cardType: "Sealed", color: null, ram: null });
const all = [...legends, ...units, greenBig, redBig, banned, sealed];
const cardsById = new Map(all.map((entry) => [entry.id, entry]));

const legal: DeckEntry[] = [
  { cardId: "goro", quantity: 1 },
  { cardId: "saburo", quantity: 1 },
  { cardId: "yorinobu", quantity: 1 },
  ...units.map((unit) => ({ cardId: unit.id, quantity: 3 })),
  { cardId: "green4", quantity: 3 },
  { cardId: "u0", quantity: 0 }, // ignoré
];

describe("analyzeDeck", () => {
  it("accepte un deck légal et calcule la RAM par couleur (exemple des règles)", () => {
    const analysis = analyzeDeck(legal.filter((entry) => entry.quantity > 0), cardsById);
    assert.deepEqual(analysis.issues, []);
    assert.equal(analysis.valid, true);
    assert.equal(analysis.legendCount, 3);
    assert.equal(analysis.mainCount, 13 * 3 + 3);
    assert.deepEqual(analysis.ramLimits, { Green: 4, Red: 2 });
    assert.equal(analysis.curve.reduce((sum, count) => sum + count, 0), analysis.mainCount);
    assert.equal(analysis.curve[7], 3 + 3); // coût 7 (u7) + green4
  });

  it("signale Legends, taille, copies, RAM, légalité et cartes inconnues", () => {
    const analysis = analyzeDeck(
      [
        { cardId: "goro", quantity: 1 },
        { cardId: "goro2", quantity: 1 },
        { cardId: "u1", quantity: 4 },
        { cardId: "red3", quantity: 1 },
        { cardId: "banned", quantity: 1 },
        { cardId: "box", quantity: 1 },
        { cardId: "disparue", quantity: 1 },
      ],
      cardsById,
    );
    const codes = analysis.issues.map((issue) => issue.code).sort();
    assert.deepEqual(codes, ["copies", "deck-size", "legend-count", "legend-name", "not-legal", "ram", "ram", "ram", "unknown", "unknown"]);
    const ram = analysis.issues.filter((issue) => issue.code === "ram");
    // Pas de Legend Red : la limite Red est 0.
    assert.ok(ram.every((issue) => issue.code === "ram" && issue.color === "Red" && issue.limit === 0));
    assert.equal(analysis.valid, false);
  });

  it("n'applique pas la RAM tant qu'aucune Legend n'est choisie", () => {
    const analysis = analyzeDeck([{ cardId: "red3", quantity: 1 }], cardsById);
    assert.ok(!analysis.issues.some((issue) => issue.code === "ram"));
  });
});

describe("collection et prix", () => {
  const printings = [
    printing("p-u0-en", "u0", "1.50"),
    printing("p-u0-fr", "u0", "0.80"),
    printing("p-u1", "u1", null),
    printing("p-green4", "green4", "12.00"),
  ];
  const items = [
    { printingId: "p-u0-en", quantity: 1 },
    { printingId: "p-u0-fr", quantity: 1 },
    { printingId: "p-green4", quantity: 5 },
  ] as CollectionItemDTO[];

  it("compte les exemplaires possédés tous tirages confondus", () => {
    assert.deepEqual([...ownedCopiesByCard(items, printings)], [
      ["u0", 2],
      ["green4", 5],
    ]);
  });

  it("choisit le tirage coté le moins cher", () => {
    assert.equal(cheapestPrinting(printings.slice(0, 2))?.printing.id, "p-u0-fr");
    assert.equal(cheapestPrinting([printing("x", "u1", "0"), printing("y", "u1", null)]), null);
  });

  it("chiffre les manquants et isole les cartes non cotées", () => {
    const lines = [
      { card: cardsById.get("u0")!, quantity: 3 },
      { card: cardsById.get("u1")!, quantity: 2 },
      { card: cardsById.get("green4")!, quantity: 3 },
    ];
    const byCard = new Map<string, PrintingDTO[]>();
    for (const entry of printings) byCard.set(entry.cardId, [...(byCard.get(entry.cardId) ?? []), entry]);
    const result = deckShortfall(lines, byCard, ownedCopiesByCard(items, printings));
    assert.equal(result.totalCopies, 8);
    assert.equal(result.ownedCopies, 2 + 0 + 3);
    assert.equal(result.missingCopies, 1 + 2);
    assert.equal(result.missingCost, 0.8);
    assert.equal(result.unpricedCopies, 2);
    // Deck complet : 3 × 0,80 + 3 × 12,00 ; les 2 u1 ne sont pas cotés.
    assert.equal(Math.round(result.deckCost * 100), 3840);
    assert.equal(result.deckUnpricedCopies, 2);
    const green = result.lines.find((line) => line.card.id === "green4")!;
    assert.equal(green.missing, 0);
    assert.equal(green.cost, 0);
  });
});

describe("export et import texte", () => {
  it("aller-retour : la liste exportée se réimporte à l'identique", () => {
    const lines = analyzeDeck(legal.filter((entry) => entry.quantity > 0), cardsById);
    const text = deckToText([...lines.legends, ...lines.main]);
    assert.ok(text.split("\n").includes("1 Goro Takemura: Hands Unclean"));
    const parsed = parseDeckText(text, all);
    assert.deepEqual(parsed.unmatched, []);
    const sort = (entries: DeckEntry[]) => [...entries].sort((a, b) => a.cardId.localeCompare(b.cardId));
    assert.deepEqual(sort(parsed.entries), sort(legal.filter((entry) => entry.quantity > 0)));
  });

  it("formats tolérés, noms ambigus et produits scellés refusés", () => {
    const parsed = parseDeckText(
      ["Legends:", "// commentaire", "2x u3", "u3", "Saburo Arasaka", "Goro Takemura", "Goro Takemura — Vengeful Bodyguard", "1 box", "12 u4"].join(
        "\n",
      ),
      all,
    );
    assert.deepEqual(parsed.unmatched, ["Goro Takemura", "1 box"]);
    assert.deepEqual(parsed.entries, [
      { cardId: "u3", quantity: 3 },
      { cardId: "saburo", quantity: 1 },
      { cardId: "goro2", quantity: 1 },
      { cardId: "u4", quantity: 9 },
    ]);
  });
});
