import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { cardWithNeighbours, publicCards } from "../../src/lib/seo/public-catalog";
import type { CardDTO, CatalogDTO, PrintingDTO } from "../../src/lib/types";

function card(id: string, overrides: Partial<CardDTO> = {}): CardDTO {
  return {
    id,
    externalId: id,
    slug: id,
    name: id.toUpperCase(),
    subname: null,
    canonicalName: id,
    rulesText: `Rules ${id}`,
    flavorText: null,
    color: "Red",
    cardType: "Unit",
    isEddiable: null,
    cost: 1,
    power: 1,
    ram: 1,
    tags: [],
    keywords: [],
    ...overrides,
  };
}

function printing(id: string, cardId: string, overrides: Partial<PrintingDTO> = {}): PrintingDTO {
  return {
    id,
    cardId,
    externalId: id,
    setCode: "welcometonightcityretail",
    setName: "Welcome to Night City",
    collectorNumber: "001",
    rarity: "Common",
    language: "en",
    localizedName: null,
    imagePath: `/card-images/${id}.webp`,
    artist: "Artist",
    printedRulesText: null,
    officialFinish: null,
    marketPrice: null,
    previousMarketPrice: null,
    ...overrides,
  };
}

const catalog: CatalogDTO = {
  sets: [],
  conditions: [],
  hasPrices: true,
  cards: [
    card("v", { name: "V", subname: "Streetkid", color: "Red" }),
    card("jackie", { color: "Blue" }),
    card("adam", { color: "Red" }),
    card("box", { cardType: "Sealed", color: null }),
    card("promo-only", { color: "Green" }),
  ],
  printings: [
    printing("v-en", "v", { collectorNumber: "005a", marketPrice: "12.50" }),
    printing("v-fr", "v", {
      collectorNumber: "005a",
      setCode: "welcometonightcityretail-fr",
      language: "fr",
      localizedName: "V — Gosse Des Rues",
      printedRulesText: "Texte français",
    }),
    printing("jackie-en", "jackie", { collectorNumber: "010" }),
    printing("adam-en", "adam", { collectorNumber: "002", marketPrice: "3.00" }),
    printing("box-p", "box", { setCode: "sealed-box-sets" }),
    printing("promo-p", "promo-only", { setCode: "PRM01", collectorNumber: "P1" }),
  ],
};

describe("seo : catalogue public", () => {
  it("exclut les produits scellés et ordonne par numéro de collection", () => {
    const cards = publicCards(catalog, "en");
    assert.deepEqual(cards.map((c) => c.slug), ["adam", "v", "jackie", "promo-only"]);
  });

  it("fiche française : nom, texte et image de l'impression française", () => {
    const v = publicCards(catalog, "fr").find((c) => c.slug === "v")!;
    assert.equal(v.name, "V — Gosse Des Rues");
    assert.equal(v.rulesText, "Texte français");
    assert.equal(v.image, "/card-images/v-fr.webp");
    assert.equal(v.thumb, "/card-images/thumb/v-fr.webp");
    assert.equal(v.translated, true);
    assert.equal(v.mainPrintingId, "v-fr");
    assert.equal(v.marketPrice, "12.50");
  });

  it("repli anglais sans impression française", () => {
    const adam = publicCards(catalog, "fr").find((c) => c.slug === "adam")!;
    assert.equal(adam.name, "ADAM");
    assert.equal(adam.rulesText, "Rules adam");
    assert.equal(adam.translated, false);
    const vEn = publicCards(catalog, "en").find((c) => c.slug === "v")!;
    assert.equal(vEn.name, "V: Streetkid");
  });

  it("précédente, suivante et même couleur", () => {
    const cards = publicCards(catalog, "en");
    const first = cardWithNeighbours(cards, "adam")!;
    assert.equal(first.previous, null);
    assert.equal(first.next?.slug, "v");
    const middle = cardWithNeighbours(cards, "v")!;
    assert.equal(middle.previous?.slug, "adam");
    assert.equal(middle.next?.slug, "jackie");
    assert.equal(cardWithNeighbours(cards, "inconnue"), null);
  });
});
