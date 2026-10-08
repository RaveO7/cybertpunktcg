import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { CollectionCsvError, collectionToCsv, parseCollectionCsv } from "../../src/lib/collection-csv";
import type { CardDTO, CatalogDTO, CollectionItemDTO, PrintingDTO } from "../../src/lib/types";

function card(id: string, name: string, subname: string | null): CardDTO {
  return {
    id,
    externalId: id,
    slug: id,
    name,
    subname,
    canonicalName: subname ? `${name} — ${subname}` : name,
    rulesText: null,
    flavorText: null,
    color: null,
    cardType: null,
    isEddiable: null,
    cost: null,
    power: null,
    ram: null,
    tags: [],
    keywords: [],
  };
}

function printing(
  id: string,
  cardId: string,
  setCode: string,
  collectorNumber: string,
  language = "en",
  localizedName: string | null = null,
): PrintingDTO {
  return {
    id,
    cardId,
    externalId: `ext-${id}`,
    setCode,
    setName: setCode,
    collectorNumber,
    rarity: "Rare",
    language,
    localizedName,
    imagePath: null,
    artist: null,
    printedRulesText: null,
    officialFinish: null,
    marketPrice: null,
    previousMarketPrice: null,
  };
}

const set = (code: string, name: string, sortOrder: number) => ({
  code,
  name,
  number: null,
  releaseDate: null,
  logoUrl: null,
  description: null,
  cardCount: 0,
  status: "available",
  sortOrder,
});

const catalog: CatalogDTO = {
  sets: [
    set("welcometonightcitybeta", "Welcome to Night City — Beta", 1),
    set("welcometonightcityretail", "Welcome to Night City — Retail", 2),
    set("welcometonightcityretail-fr", "Welcome to Night City — Retail — FR", 3),
  ],
  conditions: [],
  cards: [card("c-reb", "Rebecca", "Having a Moment"), card("c-jud", "Judy Alvarez", "Braindance Tech")],
  printings: [
    printing("p-reb-beta", "c-reb", "welcometonightcitybeta", "β12"),
    printing("p-reb", "c-reb", "welcometonightcityretail", "12"),
    printing("p-reb-fr", "c-reb", "welcometonightcityretail-fr", "12", "fr", "Rebecca — Un Moment à Soi"),
    printing("p-jud", "c-jud", "welcometonightcityretail", "40"),
  ],
  hasPrices: false,
};

const options = { defaultCondition: "NM", defaultCurrency: "EUR" };

function item(id: string, printingId: string, conditionCode: string, quantity: number, extra: Partial<CollectionItemDTO> = {}) {
  return {
    id,
    printingId,
    conditionCode,
    conditionName: conditionCode,
    quantity,
    notes: null,
    purchasePrice: null,
    purchaseCurrency: null,
    addedAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  } satisfies CollectionItemDTO;
}

describe("collection CSV : export", () => {
  it("écrit un CSV « ; » avec BOM, échappe les notes et se relit à l'identique", () => {
    const items = [
      item("i1", "p-reb", "NM", 3, { notes: 'Échange; "Paul"', purchasePrice: "4.50", purchaseCurrency: "USD" }),
      item("i2", "p-reb-fr", "LP", 1),
    ];
    const csv = collectionToCsv(items, catalog);
    assert.ok(csv.startsWith("﻿set_code;set_name;collector_number"));
    assert.match(csv, /"Échange; ""Paul"""/);

    const preview = parseCollectionCsv(csv, catalog, options);
    assert.equal(preview.format, "app");
    assert.deepEqual(preview.rejected, []);
    assert.deepEqual(preview.guessed, []);
    assert.deepEqual(
      preview.lines.toSorted((a, b) => a.printingId.localeCompare(b.printingId)),
      [
        {
          printingId: "p-reb",
          conditionCode: "NM",
          quantity: 3,
          notes: 'Échange; "Paul"',
          purchasePrice: "4.50",
          purchaseCurrency: "USD",
        },
        { printingId: "p-reb-fr", conditionCode: "LP", quantity: 1 },
      ],
    );
  });
});

describe("collection CSV : import", () => {
  it("tableur français : en-têtes libres, virgule décimale, doublons fusionnés", () => {
    const csv = [
      "Nom;Numéro;Langue;État;Quantité;Prix d'achat",
      "Judy Alvarez - Braindance Tech;40;Anglais;Near Mint;2;3,20",
      "Judy Alvarez - Braindance Tech;40;Anglais;NM;1;",
      "Rebecca — Un Moment à Soi;;Français;LP;1;",
      "Carte inconnue;999;;;1;",
      "Judy Alvarez;40;;;deux;",
    ].join("\n");
    const preview = parseCollectionCsv(csv, catalog, options);
    assert.equal(preview.format, "generic");
    assert.equal(preview.rows, 5);
    assert.deepEqual(preview.lines, [
      { printingId: "p-jud", conditionCode: "NM", quantity: 3, purchasePrice: "3.20", purchaseCurrency: "EUR" },
      { printingId: "p-reb-fr", conditionCode: "LP", quantity: 1 },
    ]);
    assert.equal(preview.copies, 4);
    assert.deepEqual(
      preview.rejected.map((issue) => [issue.row, issue.reason]),
      [
        [5, "unknown-card"],
        [6, "bad-quantity"],
      ],
    );
  });

  it("export Cardmarket : langue et état codés, playset ×4, prix de vente ignoré", () => {
    const csv = [
      "idArticle;idProduct;English Name;Local Name;Exp.;Exp. Name;Language;Condition;isFoil;isSigned;isPlayset;isAltered;Comments;Amount;Price",
      "1;904772;Rebecca - Having a Moment;Rebecca - Having a Moment;WNC;Welcome to Night City — Retail;1;EX;;;1;;;1;2.50",
      "2;904773;Rebecca - Having a Moment;Rebecca — Un Moment à Soi;WNC;Welcome to Night City — Retail;2;MT;;;;;rangée 3;2;1.00",
    ].join("\n");
    const preview = parseCollectionCsv(csv, catalog, options);
    assert.equal(preview.format, "cardmarket");
    assert.deepEqual(preview.lines, [
      { printingId: "p-reb", conditionCode: "LP", quantity: 4 },
      { printingId: "p-reb-fr", conditionCode: "NM", quantity: 2, notes: "rangée 3" },
    ]);
    assert.deepEqual(preview.guessed, []);
  });

  it("sans set ni langue, choisit le tirage le plus courant et le signale", () => {
    const preview = parseCollectionCsv("name,quantity\nRebecca - Having a Moment,1\n", catalog, options);
    assert.deepEqual(preview.lines, [{ printingId: "p-reb-beta", conditionCode: "NM", quantity: 1 }]);
    assert.equal(preview.guessed.length, 1);

    const precise = parseCollectionCsv("name,set,quantity\nRebecca - Having a Moment,Welcome to Night City — Retail,1\n", catalog, options);
    assert.deepEqual(precise.lines, [{ printingId: "p-reb", conditionCode: "NM", quantity: 1 }]);
    assert.deepEqual(precise.guessed, []);
  });

  it("erreurs de fichier", () => {
    const code = (text: string) => {
      try {
        parseCollectionCsv(text, catalog, options);
        return null;
      } catch (error) {
        return error instanceof CollectionCsvError ? error.code : "other";
      }
    };
    assert.equal(code(""), "empty");
    assert.equal(code("quantity\n"), "empty");
    assert.equal(code("foo;bar\n1;2"), "no-columns");
  });
});
