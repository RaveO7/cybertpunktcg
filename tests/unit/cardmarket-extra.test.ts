/**
 * Fonctions Cardmarket non couvertes par tests/unit/logic.test.ts :
 * date du guide, lecture des prix (repli low/avg, virgule, CSV), formats de catalogue,
 * classement par noms, appariement ambigu, et produits scellés (cardmarket-sealed).
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  languageMarketSetPairs,
  matchCardmarketPrices,
  parsePriceFile,
  parsePriceGuideDate,
  parseProductFile,
  parseProducts,
  parseTrends,
  productNameKey,
} from "../../src/lib/cardmarket";
import {
  parseSealedProductFile,
  parseSealedProducts,
  SEALED_LANGUAGES,
  sealedCategoryFor,
  sealedExternalId,
  sealedProductId,
  slugifySealed,
} from "../../src/lib/cardmarket-sealed";

describe("parsePriceGuideDate", () => {
  it("lit createdAt avec un décalage +0200 (sans deux-points)", () => {
    const date = parsePriceGuideDate('{"version":1,"createdAt":"2026-10-07T02:30:15+0200","priceGuides":[]}');
    assert.equal(date?.toISOString(), "2026-10-07T00:30:15.000Z");
  });

  it("lit createdAt au format ISO standard", () => {
    assert.equal(parsePriceGuideDate('{"createdAt": "2026-01-02T03:04:05Z"}')?.toISOString(), "2026-01-02T03:04:05.000Z");
    assert.equal(
      parsePriceGuideDate('{"createdAt":"2026-01-02T03:04:05-05:00"}')?.toISOString(),
      "2026-01-02T08:04:05.000Z",
    );
  });

  it("null si absent, invalide ou trop loin dans le fichier", () => {
    assert.equal(parsePriceGuideDate('{"priceGuides":[]}'), null);
    assert.equal(parsePriceGuideDate('{"createdAt":"pas une date"}'), null);
    assert.equal(parsePriceGuideDate("idProduct,Trend Price\n1,2"), null);
    const late = `{"pad":"${"x".repeat(1200)}","createdAt":"2026-01-02T03:04:05Z"}`;
    assert.equal(parsePriceGuideDate(late), null, "seul l'en-tête (1000 caractères) est lu");
  });
});

describe("lecture du guide de prix", () => {
  it("prend trend, sinon low, sinon avg ; ignore 0, négatifs et non numériques", () => {
    const trends = parseTrends({
      priceGuides: [
        { idProduct: 1, trend: 2.5, low: 1, avg: 3 },
        { idProduct: 2, trend: 0, low: 1.2, avg: 3 },
        { idProduct: 3, trend: null, low: null, avg: 4.444 },
        { idProduct: 4, trend: 0, low: 0, avg: 0 },
        { idProduct: 5, trend: -1 },
        { idProduct: 6, trend: "abc" },
        { idProduct: 7 },
        { trend: 9 },
        "ligne invalide",
        null,
      ],
    });
    assert.deepEqual([...trends.entries()], [
      [1, 2.5],
      [2, 1.2],
      [3, 4.44],
    ]);
  });

  it("arrondit au centime et accepte la virgule décimale et les espaces", () => {
    const trends = parseTrends([
      { idProduct: "10", "Trend Price": "1,555" },
      { idProduct: 11, trendPrice: " 1 234,5 " },
      { idproduct: 12, TREND: 0.004 },
    ]);
    assert.equal(trends.get(10), 1.56);
    assert.equal(trends.get(11), 1234.5);
  });

  // Régression : readEuro filtrait « <= 0 » avant l'arrondi ; 0,004 € devenait un prix de 0 €
  // (alors qu'un 0 signifie « pas de prix » partout ailleurs).
  it("un prix < 0,005 € (arrondi à 0) est ignoré", () => {
    const trends = parseTrends([{ idproduct: 12, TREND: 0.004 }]);
    assert.equal(trends.has(12), false);
  });

  it("CSV avec point-virgule, guillemets et BOM", () => {
    const text = '﻿idProduct;"Trend Price";Low Price\r\n1;"2,50";1\r\n2;;"0,90"\r\n\r\n';
    const trends = parsePriceFile(text);
    assert.deepEqual([...trends.entries()], [
      [1, 2.5],
      [2, 0.9],
    ]);
  });

  it("CSV vide ou réduit à l'en-tête : aucun prix", () => {
    assert.equal(parsePriceFile("idProduct,Trend Price").size, 0);
    assert.equal(parsePriceFile("").size, 0);
  });

  it("JSON sans tableau de prix reconnu : erreur", () => {
    assert.throws(() => parsePriceFile('{"autre":[]}'), /Guide de prix illisible/);
    assert.throws(() => parsePriceFile("{pas du json"), SyntaxError);
  });

  it("clés alternatives priceguides / prices", () => {
    assert.equal(parsePriceFile('{"priceguides":[{"idProduct":1,"trend":1}]}').get(1), 1);
    assert.equal(parsePriceFile('{"prices":[{"idProduct":2,"low":2}]}').get(2), 2);
  });
});

describe("lecture du catalogue produits", () => {
  it("formats : clé product, extension imbriquée, URL du site, numéro dans le nom", () => {
    const products = parseProductFile(
      JSON.stringify({
        product: [
          { idProduct: 1, enName: "Nested", expansion: { enName: "Welcome to Night City" } },
          { idProduct: 2, Name: "From Url", website: "/en/Cyberpunk/Products/Singles/The-Heist-Demo-Deck/From-Url" },
          { idProduct: 3, name: "Beta Card (β012)" },
          { idProduct: 4, name: "Version Card (V.2)" },
          { idProduct: 5, name: "Promo", number: "MS01" },
          { idProduct: 6, name: "Numbered", number: 42, "Expansion ID": "77" },
          { idProduct: "x", name: "id invalide" },
          { idProduct: 8, name: "   " },
        ],
      }),
    );
    assert.deepEqual(products, [
      { idProduct: 1, name: "Nested", expansionName: "Welcome to Night City", idExpansion: null, number: null },
      { idProduct: 2, name: "From Url", expansionName: "The Heist Demo Deck", idExpansion: null, number: null },
      { idProduct: 3, name: "Beta Card (β012)", expansionName: null, idExpansion: null, number: "β012" },
      { idProduct: 4, name: "Version Card (V.2)", expansionName: null, idExpansion: null, number: null },
      { idProduct: 5, name: "Promo", expansionName: null, idExpansion: null, number: null },
      { idProduct: 6, name: "Numbered", expansionName: null, idExpansion: 77, number: "42" },
    ]);
  });

  it("catalogue illisible : erreur explicite", () => {
    assert.throws(() => parseProductFile('{"autre":1}'), /Catalogue produits illisible/);
    assert.throws(() => parseProducts("texte"), /Catalogue produits illisible/);
  });

  it("productNameKey ignore la mention de version et les accents", () => {
    assert.equal(productNameKey("Judy Álvarez - Nothing to Doubt (V.1)"), productNameKey("Judy Alvarez — Nothing to Doubt"));
    assert.equal(productNameKey("Card (v 12)"), "card");
  });

  it("languageMarketSetPairs : uniquement les paires set / set-fr existantes", () => {
    assert.deepEqual(languageMarketSetPairs(["a", "a-fr", "b", "c-fr", "a"]), [["a", "a-fr"]]);
    assert.deepEqual(languageMarketSetPairs([]), []);
  });
});

describe("matchCardmarketPrices : cas limites", () => {
  const sets = [{ code: "zset", name: "Zeta Set" }];

  it("plus de produits que d'impressions : les extrêmes sont appariés, le reste compté ambigu", () => {
    const report = matchCardmarketPrices(
      [
        { idProduct: 1, name: "Twin", expansionName: "Zeta Set", idExpansion: null, number: null },
        { idProduct: 2, name: "Twin", expansionName: "Zeta Set", idExpansion: null, number: null },
        { idProduct: 3, name: "Twin", expansionName: "Zeta Set", idExpansion: null, number: null },
      ],
      new Map([
        [1, 5],
        [2, 1],
        [3, 3],
      ]),
      sets,
      [
        { id: "late", setCode: "zset", collectorNumber: "120", name: "Twin" },
        { id: "early", setCode: "zset", collectorNumber: "7", name: "Twin" },
      ],
    );
    const byId = new Map(report.assignments.map((row) => [row.printingId, row.amount]));
    // Le moins cher va au plus petit numéro, le plus cher au plus grand.
    assert.equal(byId.get("early"), "1.00");
    assert.equal(byId.get("late"), "5.00");
    assert.equal(report.matchedProducts, 2);
    assert.equal(report.ambiguousProducts, 1);
    assert.equal(report.unmatchedSamples.length, 3);
  });

  it("produit coté sans impression locale : ambigu, aucun prix", () => {
    const report = matchCardmarketPrices(
      [{ idProduct: 1, name: "Ghost", expansionName: "Zeta Set", idExpansion: null, number: null }],
      new Map([[1, 2]]),
      sets,
      [{ id: "p", setCode: "zset", collectorNumber: "1", name: "Other" }],
    );
    assert.equal(report.assignments.length, 0);
    assert.equal(report.ambiguousProducts, 1);
    assert.deepEqual(report.unmatchedSamples, ["Ghost"]);
  });

  it("produit sans prix : ni compté coté ni associé", () => {
    const report = matchCardmarketPrices(
      [{ idProduct: 1, name: "Card", expansionName: "Zeta Set", idExpansion: null, number: "1" }],
      new Map(),
      sets,
      [{ id: "p", setCode: "zset", collectorNumber: "1", name: "Card" }],
    );
    assert.equal(report.pricedProducts, 0);
    assert.equal(report.assignments.length, 0);
  });

  it("extension inconnue : comptée, échantillons limités à 12", () => {
    const products = Array.from({ length: 20 }, (_, index) => ({
      idProduct: index + 1,
      name: `Card ${index}`,
      expansionName: "Nowhere",
      idExpansion: null,
      number: null,
    }));
    const report = matchCardmarketPrices(products, new Map(products.map((p) => [p.idProduct, 1])), sets, []);
    assert.equal(report.unknownExpansionProducts, 20);
    assert.deepEqual(report.unknownExpansions, ["Nowhere"]);
    assert.equal(report.unmatchedSamples.length, 12);
  });

  it("sans info d'extension : rattachement par les noms du set (rappel/précision)", () => {
    const report = matchCardmarketPrices(
      [
        { idProduct: 1, name: "Alpha", expansionName: null, idExpansion: 5, number: "1" },
        { idProduct: 2, name: "Beta", expansionName: null, idExpansion: 5, number: "2" },
      ],
      new Map([
        [1, 1],
        [2, 2],
      ]),
      [
        { code: "zset", name: "Zeta Set" },
        { code: "zset-fr", name: "Zeta Set FR" },
      ],
      [
        { id: "a", setCode: "zset", collectorNumber: "1", name: "Alpha" },
        { id: "b", setCode: "zset", collectorNumber: "2", name: "Beta" },
        { id: "afr", setCode: "zset-fr", collectorNumber: "1", name: "Alpha" },
        { id: "bfr", setCode: "zset-fr", collectorNumber: "2", name: "Beta" },
      ],
    );
    assert.deepEqual(
      report.assignments.map((row) => row.printingId).sort(),
      ["a", "b"],
      "les sets -fr ne doivent jamais recevoir un prix par les noms",
    );
    assert.deepEqual(report.expansions, [{ key: "id:5", setCode: "zset", products: 2 }]);
  });

  it("deux libellés d'extension contradictoires dans un même idExpansion : non rattaché", () => {
    const report = matchCardmarketPrices(
      [
        { idProduct: 1, name: "Alpha", expansionName: "Zeta Set", idExpansion: 5, number: "1" },
        { idProduct: 2, name: "Beta", expansionName: "Other Set", idExpansion: 5, number: "2" },
      ],
      new Map([
        [1, 1],
        [2, 2],
      ]),
      [...sets, { code: "oset", name: "Other Set" }],
      [{ id: "a", setCode: "zset", collectorNumber: "1", name: "Alpha" }],
    );
    assert.equal(report.assignments.length, 0);
    assert.equal(report.unknownExpansionProducts, 2);
  });
});

describe("produits scellés (cardmarket-sealed)", () => {
  it("externalId par langue et lecture inverse de l'id produit", () => {
    assert.deepEqual([...SEALED_LANGUAGES], ["en", "fr"]);
    assert.equal(sealedExternalId(123), "cardmarket:123");
    assert.equal(sealedExternalId(123, "en"), "cardmarket:123");
    assert.equal(sealedExternalId(123, "fr"), "cardmarket:123:fr");
    assert.equal(sealedProductId("cardmarket:123"), 123);
    assert.equal(sealedProductId("cardmarket:123:fr"), 123);
    assert.equal(sealedProductId("cardmarket:abc"), null);
    assert.equal(sealedProductId("cardmarket:1.5"), null);
    assert.equal(sealedProductId("ci-card-1"), null);
  });

  // Régression : Number("") vaut 0 → un externalId « cardmarket: » donnait le produit 0.
  it("sealedProductId('cardmarket:') renvoie null", () => {
    assert.equal(sealedProductId("cardmarket:"), null);
  });

  it("catégorie par id, puis par nom, sinon « sealed-other »", () => {
    assert.equal(sealedCategoryFor({ idCategory: 1670, categoryName: "n'importe" }).code, "sealed-booster-boxes");
    assert.equal(sealedCategoryFor({ idCategory: 1663, categoryName: "" }).cardType, "Lot");
    assert.equal(sealedCategoryFor({ idCategory: null, categoryName: "Cyberpunk Booster Boxes" }).code, "sealed-booster-boxes");
    assert.equal(sealedCategoryFor({ idCategory: 9999, categoryName: "CPK Set" }).code, "sealed-lots");
    assert.equal(sealedCategoryFor({ idCategory: null, categoryName: "  cyberpunk   STARTER decks " }).code, "sealed-starter-decks");
    assert.deepEqual(sealedCategoryFor({ idCategory: 1, categoryName: "Inconnue" }), {
      code: "sealed-other",
      name: "Produits scellés",
      sortOrder: 990,
      cardType: "Sealed",
    });
  });

  it("lecture du catalogue scellé : tableau ou { products }, lignes invalides ignorées", () => {
    const fromObject = parseSealedProductFile(
      "﻿" +
        JSON.stringify({
          products: [
            { idProduct: 1, name: " Booster Box ", categoryName: "Cyberpunk Booster Boxes", idCategory: 1670, idExpansion: 9 },
            { idproduct: "2", Name: "Lot", Category: "CPK Set", "Category ID": "1663", "Expansion ID": "x" },
            { idProduct: 3, enName: 404 },
            { idProduct: 4 },
            { name: "sans id" },
            [1, 2],
            null,
          ],
        }),
    );
    assert.deepEqual(fromObject, [
      { idProduct: 1, name: "Booster Box", categoryName: "Cyberpunk Booster Boxes", idCategory: 1670, idExpansion: 9 },
      { idProduct: 2, name: "Lot", categoryName: "CPK Set", idCategory: 1663, idExpansion: null },
      { idProduct: 3, name: "404", categoryName: "Sealed", idCategory: null, idExpansion: null },
    ]);
    assert.equal(parseSealedProducts([{ idProduct: 5, name: "X" }]).length, 1);
    assert.throws(() => parseSealedProducts({ autre: [] }), /illisible/);
    assert.throws(() => parseSealedProductFile("pas du json"), SyntaxError);
  });

  // Régression : readInt("") → Number("") = 0 → idProduct 0 accepté (idem readId de cardmarket.ts).
  it("un idProduct vide est ignoré (pas de produit 0)", () => {
    assert.deepEqual(parseSealedProducts([{ idProduct: "", name: "Vide" }]), []);
  });

  it("slug : minuscules sans accents ni ponctuation, préfixé et suffixé par l'id", () => {
    assert.equal(slugifySealed("Booster Box — Édition Spéciale!", 42), "cm-booster-box-edition-speciale-42");
    assert.equal(slugifySealed("!!!", 7), "cm-product-7");
    assert.ok(slugifySealed("x".repeat(200), 1).length <= 80);
  });

  // Régression : le slug était tronqué à 80 caractères APRÈS l'ajout de l'id produit ; deux noms
  // longs de même début donnaient le même slug (Card.slug est unique) → l'import des prix échouait.
  it("deux noms longs donnent des slugs distincts, finissant par l'id produit", () => {
    const name = "Cyberpunk TCG Welcome to Night City Booster Display Box of 24 boosters English edition";
    const left = slugifySealed(name, 1001);
    const right = slugifySealed(name, 1002);
    assert.notEqual(left, right);
    assert.ok(left.endsWith("-1001"));
  });
});
