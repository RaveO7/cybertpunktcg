import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  aggregateCollection,
  alignReleasedFilters,
  applyInvestmentPeriod,
  baseCollectorNumber,
  buildFacets,
  buildInvestmentLines,
  defaultFilters,
  equivalentPrintingIds,
  filterInvestmentLines,
  formatInt,
  formatMoney,
  formatPercent,
  frenchChecklist,
  investmentBySet,
  isReleasedSet,
  languageOptions,
  marketValue,
  matchesSearch,
  mergeEquivalentOwnership,
  normalizeSetCode,
  normalizeText,
  numberMatches,
  parseFilters,
  printingIdentity,
  printingTitle,
  printingsPriceTotal,
  progressByRarity,
  progressBySet,
  releasedChecklist,
  resolveRulesText,
  sealedBrowseFilters,
  serializeFilters,
  setForLanguage,
  sortPrintings,
  spentAmount,
  summarizeInvestment,
  type InvestmentLine,
} from "../../src/lib/logic";
import type { CardDTO, CollectionItemDTO, Filters, Ownership, PrintingDTO, SetDTO, SortKey } from "../../src/lib/types";

function card(partial: Partial<CardDTO> & Pick<CardDTO, "id">): CardDTO {
  return {
    externalId: partial.id,
    slug: partial.id,
    name: partial.name ?? "Carte",
    subname: null,
    canonicalName: partial.canonicalName ?? partial.name ?? "Carte",
    rulesText: null,
    flavorText: null,
    color: "Red",
    cardType: "Unit",
    isEddiable: null,
    cost: 1,
    power: 1,
    ram: 1,
    tags: [],
    keywords: [],
    ...partial,
  };
}

function printing(partial: Partial<PrintingDTO> & Pick<PrintingDTO, "id">): PrintingDTO {
  return {
    cardId: partial.id,
    collectorNumber: "001",
    externalId: partial.id,
    setCode: "welcometonightcityretail",
    setName: "Welcome to Night City — Retail",
    rarity: "Common",
    language: "en",
    localizedName: null,
    imagePath: null,
    artist: null,
    printedRulesText: null,
    officialFinish: null,
    marketPrice: null,
    previousMarketPrice: null,
    ...partial,
  };
}

function item(partial: Partial<CollectionItemDTO> & Pick<CollectionItemDTO, "printingId" | "quantity">): CollectionItemDTO {
  return {
    id: partial.id ?? `${partial.printingId}-${partial.conditionCode ?? "NM"}`,
    conditionCode: "NM",
    conditionName: "Near Mint",
    notes: null,
    purchasePrice: null,
    purchaseCurrency: null,
    addedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function set(partial: Partial<SetDTO> & Pick<SetDTO, "code">): SetDTO {
  return {
    name: partial.code,
    number: null,
    releaseDate: null,
    logoUrl: null,
    description: null,
    cardCount: 0,
    status: "released",
    sortOrder: 0,
    ...partial,
  };
}

function line(partial: Partial<InvestmentLine> & Pick<InvestmentLine, "itemId">): InvestmentLine {
  return {
    printingId: partial.itemId,
    cardId: "c",
    title: "Carte",
    setCode: "welcometonightcityretail",
    setName: "Retail",
    collectorNumber: "001",
    language: "en",
    rarity: "Common",
    imagePath: null,
    quantity: 1,
    conditionCode: "NM",
    marketUnit: null,
    previousMarketUnit: null,
    marketTotal: null,
    purchaseUnit: null,
    purchaseCurrency: null,
    purchaseTotal: null,
    profit: null,
    marketDelta: "none",
    ...partial,
  };
}

const ids = (list: { id: string }[]) => list.map((entry) => entry.id);
const own = (entries: [string, number, string[]?][]) =>
  new Map<string, Ownership>(entries.map(([id, qty, conditions]) => [id, { qty, conditions: conditions ?? ["NM"] }]));

describe("identités et codes de set", () => {
  it("baseCollectorNumber retire uniquement le β initial", () => {
    assert.equal(baseCollectorNumber("β005a"), "005a");
    assert.equal(baseCollectorNumber("005a"), "005a");
    assert.equal(baseCollectorNumber("ββ1"), "β1");
    assert.equal(baseCollectorNumber("1β"), "1β");
  });

  it("printingIdentity confond beta et retail d'une même langue, jamais deux langues", () => {
    const retail = printing({ id: "r", cardId: "c", collectorNumber: "005a" });
    const beta = printing({ id: "b", cardId: "c", collectorNumber: "β005a", setCode: "welcometonightcitybeta" });
    const fr = printing({ id: "f", cardId: "c", collectorNumber: "005a", language: "fr" });
    assert.equal(printingIdentity(retail), printingIdentity(beta));
    assert.notEqual(printingIdentity(retail), printingIdentity(fr));
    assert.deepEqual(equivalentPrintingIds(retail, [retail, beta, fr]).sort(), ["b", "r"]);
    assert.deepEqual(equivalentPrintingIds(fr, [retail, beta]), []);
  });

  it("isReleasedSet / normalizeSetCode", () => {
    for (const id of ["wtmc", "wtmc-en", "wtmc-fr", "wtmc-both"]) assert.equal(isReleasedSet(id), true, id);
    for (const id of ["all", "welcometonightcityretail", ""]) assert.equal(isReleasedSet(id), false, id);
    assert.equal(normalizeSetCode("wtmc"), "wtmc-en");
    assert.equal(normalizeSetCode("wtmc-both"), "wtmc-en");
    assert.equal(normalizeSetCode("wtmc-fr"), "welcometonightcityretail-fr");
    assert.equal(normalizeSetCode("autre"), "autre");
  });
});

describe("checklists et possession fusionnée", () => {
  const printings = [
    printing({ id: "retail", cardId: "a", collectorNumber: "005a" }),
    printing({ id: "beta", cardId: "a", collectorNumber: "β005a", setCode: "welcometonightcitybeta" }),
    printing({ id: "fr", cardId: "a", collectorNumber: "005a", setCode: "welcometonightcityretail-fr", language: "fr" }),
  ];

  it("frenchChecklist présente les cartes FR sous le set virtuel wtmc-fr sans modifier l'entrée", () => {
    const list = frenchChecklist(printings);
    assert.deepEqual(ids(list), ["fr"]);
    assert.equal(list[0].setCode, "wtmc-fr");
    assert.equal(printings[2].setCode, "welcometonightcityretail-fr");
  });

  it("releasedChecklist : wtmc / wtmc-both = anglais + français ; set ordinaire → null", () => {
    for (const id of ["wtmc", "wtmc-both"]) assert.deepEqual(ids(releasedChecklist(printings, id) ?? []), ["retail", "fr"]);
    assert.equal(releasedChecklist(printings, "welcometonightcityretail"), null);
    assert.equal(releasedChecklist(printings, "all"), null);
    assert.deepEqual(releasedChecklist([], "wtmc-en"), []);
  });

  it("mergeEquivalentOwnership additionne beta + retail, dédoublonne les états, ne modifie pas l'agrégat", () => {
    const agg = own([
      ["retail", 1, ["NM"]],
      ["beta", 2, ["NM", "LP"]],
    ]);
    const merged = mergeEquivalentOwnership([printings[0]], printings, agg);
    assert.deepEqual(merged.get("retail"), { qty: 3, conditions: ["NM", "LP"] });
    assert.deepEqual(agg.get("retail"), { qty: 1, conditions: ["NM"] });
    // Une carte de la checklist absente du pool garde sa propre possession.
    const alone = printing({ id: "seule", cardId: "z" });
    assert.equal(mergeEquivalentOwnership([alone], [], own([["seule", 4]])).get("seule")?.qty, 4);
  });

  it("aggregateCollection ignore les quantités nulles ou négatives", () => {
    const agg = aggregateCollection([
      item({ printingId: "a", quantity: 0 }),
      item({ printingId: "a", quantity: -3, conditionCode: "LP" }),
      item({ printingId: "b", quantity: 2 }),
    ]);
    assert.equal(agg.has("a"), false);
    assert.deepEqual(agg.get("b"), { qty: 2, conditions: ["NM"] });
    assert.equal(aggregateCollection([]).size, 0);
  });
});

describe("langues et filtres d'extension (cas limites)", () => {
  const codes = [{ setCode: "promo" }, { setCode: "promo-fr" }, { setCode: "solo-fr" }];

  it("setForLanguage", () => {
    assert.equal(setForLanguage("promo", "", codes), null);
    assert.equal(setForLanguage("all", "fr", codes), null);
    assert.equal(setForLanguage("promo", "fr", codes), "promo-fr");
    assert.equal(setForLanguage("promo-fr", "fr", codes), null);
    assert.equal(setForLanguage("promo-fr", "en", codes), "promo");
    assert.equal(setForLanguage("solo-fr", "en", codes), null);
    assert.equal(setForLanguage("promo", "en", codes), null);
    assert.equal(setForLanguage("promo", "de", codes), null);
    assert.equal(setForLanguage("welcometonightcityretail", "fr", []), null);
    assert.equal(setForLanguage("wtmc-fr", "en", []), "welcometonightcityretail");
  });

  it("languageOptions : scellé bilingue, jumeau -fr, langues supplémentaires triées après en/fr", () => {
    const printings = [
      { setCode: "promo", language: "en" },
      { setCode: "promo-fr", language: "fr" },
    ];
    assert.deepEqual(languageOptions("sealed-box", [], []), ["en", "fr"]);
    assert.deepEqual(languageOptions("promo", printings, ["it", "de", "en"]), ["en", "fr", "de", "it"]);
    assert.deepEqual(languageOptions("solo-fr", printings, []), ["fr"]);
    assert.deepEqual(languageOptions("all", printings, ["en"]), ["en"]);
    assert.deepEqual(languageOptions("inconnu", [], []), []);
  });

  it("alignReleasedFilters : scellé garde fr, sinon anglais ; nouveau set ordinaire → anglais", () => {
    const base = defaultFilters();
    assert.equal(alignReleasedFilters({ ...base, set: "sealed-box", language: "fr" }).language, "fr");
    assert.equal(alignReleasedFilters({ ...base, set: "sealed-box", language: "de" }).language, "en");
    assert.equal(alignReleasedFilters({ ...base, set: "sealed-box", language: "" }).language, "en");
    assert.equal(alignReleasedFilters({ ...base, set: "promo-fr", language: "en" }).language, "fr");
    assert.equal(alignReleasedFilters({ ...base, set: "promo", language: "fr" }, { set: "promo" }).language, "en");
    // Sans changement de set demandé, la langue d'un set ordinaire est conservée.
    assert.equal(alignReleasedFilters({ ...base, set: "promo", language: "fr" }).language, "fr");
  });

  it("sealedBrowseFilters remet les filtres carte à zéro", () => {
    const filters = sealedBrowseFilters("sealed-box", {
      language: "fr",
      colors: ["Red"],
      rarity: "Rare",
      q: "boite",
      printingId: "x",
      collection: "owned",
    });
    assert.equal(filters.set, "sealed-box");
    assert.equal(filters.language, "fr");
    assert.deepEqual(filters.colors, []);
    assert.equal(filters.rarity, "");
    assert.equal(filters.printingId, null);
    assert.equal(filters.sort, "name-asc");
    assert.equal(filters.page, 1);
    // Recherche et filtre de possession sont conservés.
    assert.equal(filters.q, "boite");
    assert.equal(filters.collection, "owned");
    assert.equal(sealedBrowseFilters("sealed-box", { language: "it" }).language, "en");
    assert.equal(sealedBrowseFilters("sealed-box", { sort: "cost-desc", page: 3 }).sort, "cost-desc");
  });
});

describe("parseFilters / serializeFilters", () => {
  it("valeurs d'URL invalides → valeurs par défaut", () => {
    for (const page of ["abc", "-3", "0", "Infinity", ""]) {
      assert.equal(parseFilters(new URLSearchParams({ page })).page, 1, `page=${page}`);
    }
    assert.equal(parseFilters(new URLSearchParams("page=2.9")).page, 2);
    const parsed = parseFilters(new URLSearchParams("sort=prix&collection=tout&eddiable=oui&color=Red,,%20Blue%20,"));
    assert.equal(parsed.sort, "number-asc");
    assert.equal(parsed.collection, "all");
    assert.equal(parsed.eddiable, "");
    assert.deepEqual(parsed.colors, ["Red", "Blue"]);
    assert.equal(parseFilters(new URLSearchParams("language=both")).language, "");
    assert.equal(parseFilters(new URLSearchParams("set=wtmc-both")).language, "");
    assert.equal(parseFilters(new URLSearchParams("set=wtmc-both&language=fr")).set, "welcometonightcityretail-fr");
    assert.equal(parseFilters(new URLSearchParams(""), false).set, "all");
  });

  it("l'URL par défaut est vide", () => {
    assert.equal(serializeFilters(defaultFilters()).toString(), "");
    const prefs = { sort: "rarity" as SortKey, collection: "owned" as const };
    assert.equal(serializeFilters(defaultFilters(true, prefs), true, prefs).has("sort"), false);
  });

  it("aller-retour URL → filtres sans perte", () => {
    const base = defaultFilters();
    const cases: { filters: Filters; prefs?: { sort?: SortKey; collection?: Filters["collection"] } }[] = [
      { filters: base },
      {
        filters: {
          ...base,
          q: "V streetkid 5a",
          set: "welcometonightcityretail",
          colors: ["Red", "Blue"],
          types: ["Unit"],
          tags: ["Merc"],
          keywords: ["Blocker"],
          costs: ["0", "10"],
          powers: ["3"],
          rams: ["1"],
          artists: ["Ada Lovelace"],
          eddiable: "false",
          rarity: "Iconic Legend",
          collection: "duplicates",
          condition: "LP",
          sort: "cost-desc",
          page: 4,
          printingId: "p-42",
        },
      },
      { filters: { ...base, set: "all", language: "" } },
      { filters: { ...base, set: "welcometonightcityretail-fr", language: "fr" } },
      { filters: { ...base, sort: "number-asc" }, prefs: { sort: "name-asc" } },
      { filters: { ...base, collection: "missing" }, prefs: { collection: "owned" } },
    ];
    for (const { filters, prefs } of cases) {
      const params = serializeFilters(filters, true, prefs);
      const parsed = parseFilters(new URLSearchParams(params.toString()), true, prefs);
      assert.deepEqual(parsed, filters, params.toString());
    }
  });

  // Attendu : les noms d'artistes / tags sont des valeurs opaques ; « Doe, John » doit survivre à l'URL.
  // Observé : les listes sont jointes puis découpées sur « , » → ["Doe", "John"].
  it("une valeur de liste contenant une virgule survit à l'aller-retour URL", () => {
    const filters = { ...defaultFilters(), artists: ["Doe, John"] };
    assert.deepEqual(parseFilters(serializeFilters(filters)).artists, ["Doe, John"]);
  });

  // Attendu (SettingsScreen : « Filtre de possession appliqué au démarrage et à la réinitialisation ») :
  // sans paramètre d'URL, la préférence de collection s'applique comme celle du tri.
  // Observé : parseFilters ignore prefs.collection et force « all » (CardsExplorer.tsx:139).
  // Corriger aussi serializeFilters (set("collection", …, "all") → defaults.collection) pour garder l'aller-retour.
  it("la préférence « filtre collection » s'applique au démarrage (URL sans paramètre)", () => {
    const prefs = { sort: "rarity" as SortKey, collection: "owned" as const };
    const parsed = parseFilters(new URLSearchParams(""), true, prefs);
    assert.equal(parsed.sort, "rarity");
    assert.equal(parsed.collection, "owned");
  });
});

describe("recherche", () => {
  it("normalizeText : accents, casse, β, ponctuation", () => {
    assert.equal(normalizeText("  Ça va — DÉJÀ vu!  "), "ca va deja vu");
    assert.equal(normalizeText("β005a"), "b005a");
    assert.equal(normalizeText("日本語"), "");
    assert.equal(normalizeText(""), "");
  });

  it("numberMatches : zéros initiaux, suffixe, β, recherche partielle non numérique", () => {
    assert.equal(numberMatches("β005a", "β5"), true);
    assert.equal(numberMatches("β005a", "b5a"), true);
    assert.equal(numberMatches("005", "5a"), false);
    assert.equal(numberMatches("005", ""), false);
    assert.equal(numberMatches("005", "   "), false);
    assert.equal(numberMatches("PRM-012", "prm"), true);
    assert.equal(numberMatches("PRM-012", "12"), false);
  });

  it("matchesSearch : tous les mots, accents ignorés, nom localisé, numéro", () => {
    const c = card({ id: "c", name: "Rôdeur", canonicalName: "Rôdeur des rues", rulesText: "Pioche une carte." });
    const p = printing({ id: "p", cardId: "c", collectorNumber: "012", localizedName: "Street Prowler" });
    assert.equal(matchesSearch(c, p, ""), true);
    assert.equal(matchesSearch(c, p, "   "), true);
    assert.equal(matchesSearch(c, p, "rodeur"), true);
    assert.equal(matchesSearch(c, p, "RODEUR prowler 12"), true);
    assert.equal(matchesSearch(c, p, "rodeur 13"), false);
    assert.equal(matchesSearch(c, p, "pioche"), true);
    assert.equal(matchesSearch(c, p, "retail"), true, "nom du set");
    assert.equal(matchesSearch(c, p, "dragon"), false);
  });
});

describe("sortPrintings", () => {
  const cards = new Map<string, CardDTO>([
    ["red-unit", card({ id: "red-unit", name: "Bravo", color: "Red", cardType: "Unit", cost: 2 })],
    ["red-legend", card({ id: "red-legend", name: "Zed", color: "Red", cardType: "Legend", cost: 5 })],
    ["blue", card({ id: "blue", name: "Alpha", color: "Blue", cardType: "Unit", cost: 1 })],
    ["none", card({ id: "none", name: "Écho", color: null, cardType: null, cost: null })],
  ]);
  const printings = [
    printing({ id: "p10", cardId: "blue", collectorNumber: "010", marketPrice: "2.00", rarity: "Rare", setCode: "b" }),
    printing({ id: "p9", cardId: "red-unit", collectorNumber: "009", marketPrice: null, rarity: null, setCode: "a" }),
    printing({ id: "pb1", cardId: "red-legend", collectorNumber: "β001", marketPrice: "10", rarity: "Iconic Legend", setCode: "a" }),
    printing({ id: "p9b", cardId: "none", collectorNumber: "009b", marketPrice: "2.00", rarity: "Mythique", setCode: "zz" }),
    printing({ id: "p9a", cardId: "red-unit", collectorNumber: "009a", marketPrice: "abc", rarity: "Common", setCode: "a" }),
  ];
  const sets = new Map([
    ["a", set({ code: "a", sortOrder: 2 })],
    ["b", set({ code: "b", sortOrder: 1 })],
  ]);
  const sort = (key: SortKey, agg = new Map<string, Ownership>()) => ids(sortPrintings(printings, cards, agg, sets, key));

  it("numéro : naturel, suffixes, beta après la retail ; desc = inverse exact", () => {
    assert.deepEqual(sort("number-asc"), ["p9", "p9a", "p9b", "p10", "pb1"]);
    assert.deepEqual(sort("number-desc"), ["pb1", "p10", "p9b", "p9a", "p9"]);
  });

  it("prix : les cartes sans prix (ou prix illisible) restent à la fin dans les deux sens", () => {
    assert.deepEqual(sort("cost-asc"), ["p9b", "p10", "pb1", "p9", "p9a"]);
    assert.deepEqual(sort("cost-desc"), ["pb1", "p9b", "p10", "p9", "p9a"]);
  });

  it("rareté : ordre officiel, rareté inconnue puis absente à la fin", () => {
    assert.deepEqual(sort("rarity"), ["p9a", "p10", "pb1", "p9b", "p9"]);
  });

  it("set : ordre du set, set inconnu en dernier", () => {
    assert.deepEqual(sort("set"), ["p10", "p9", "p9a", "pb1", "p9b"]);
  });

  it("nom : collation française (« Écho » entre B et Z), égalités dans l'ordre reçu", () => {
    assert.deepEqual(sort("name-asc"), ["p10", "p9", "p9a", "p9b", "pb1"]);
    assert.deepEqual(sort("name-desc"), ["pb1", "p9b", "p9", "p9a", "p10"]);
  });

  it("par défaut : couleur, type, coût ; carte sans couleur à la fin", () => {
    assert.deepEqual(sort("default"), ["pb1", "p9", "p9a", "p10", "p9b"]);
  });

  it("possédées / manquantes d'abord, puis ordre par défaut", () => {
    const agg = own([["p10", 1], ["p9b", 2]]);
    assert.deepEqual(sort("owned-first", agg), ["p10", "p9b", "pb1", "p9", "p9a"]);
    assert.deepEqual(sort("missing-first", agg), ["pb1", "p9", "p9a", "p10", "p9b"]);
  });

  it("quantité possédée : croissante / décroissante, égalités par numéro", () => {
    const agg = own([["p10", 1], ["p9b", 3], ["pb1", 1]]);
    assert.deepEqual(sort("qty-asc", agg), ["p9", "p9a", "p10", "pb1", "p9b"]);
    assert.deepEqual(sort("qty-desc", agg), ["p9b", "p10", "pb1", "p9", "p9a"]);
  });

  it("ne modifie pas la liste reçue ; liste vide", () => {
    const before = ids(printings);
    sort("cost-desc");
    assert.deepEqual(ids(printings), before);
    assert.deepEqual(sortPrintings([], cards, new Map(), sets, "rarity"), []);
  });
});

describe("progression et facettes", () => {
  it("progressByRarity : ordre officiel, rareté absente regroupée sous « Inconnue » en dernier", () => {
    const printings = [
      printing({ id: "1", rarity: "Rare" }),
      printing({ id: "2", rarity: null }),
      printing({ id: "3", rarity: "Common" }),
      printing({ id: "4", rarity: "Common" }),
    ];
    const result = progressByRarity(printings, own([["3", 2]]));
    assert.deepEqual(result.map((r) => [r.rarity, r.total, r.uniqueOwned]), [
      ["Common", 2, 1],
      ["Rare", 1, 0],
      ["Inconnue", 1, 0],
    ]);
    assert.equal(result[0].percent, 50);
    assert.deepEqual(progressByRarity([], new Map()), []);
  });

  it("progressBySet : tri par sortOrder puis nom, sets vides inclus à 0 %, entrée intacte", () => {
    const sets = [set({ code: "b", name: "B", sortOrder: 1 }), set({ code: "a", name: "A", sortOrder: 1 }), set({ code: "z", sortOrder: 0 })];
    const result = progressBySet([printing({ id: "1", setCode: "a" })], sets, own([["1", 1]]));
    assert.deepEqual(result.map((r) => [r.set.code, r.total, r.percent]), [
      ["z", 0, 0],
      ["a", 1, 100],
      ["b", 0, 0],
    ]);
    assert.deepEqual(sets.map((s) => s.code), ["b", "a", "z"]);
  });

  it("buildFacets : ordres officiels, tri numérique, valeurs nulles exclues", () => {
    const cards = new Map([
      ["a", card({ id: "a", color: "Blue", cardType: "Gear", cost: 10, power: null, tags: ["Zeta", "alpha"], isEddiable: false })],
      ["b", card({ id: "b", color: "Red", cardType: "Legend", cost: 2, ram: null, keywords: ["Blocker"] })],
      ["c", card({ id: "c", color: "Purple", cardType: "Unit", cost: 0 })],
    ]);
    const facets = buildFacets(
      [
        printing({ id: "1", cardId: "a", language: "fr", rarity: "Secret", artist: "Zoé" }),
        printing({ id: "2", cardId: "b", rarity: "Common", artist: "adam" }),
        printing({ id: "3", cardId: "c", rarity: null }),
        printing({ id: "4", cardId: "orpheline", rarity: "Exotique", artist: "Orphan" }),
      ],
      cards,
    );
    assert.deepEqual(facets.languages, ["en", "fr"]);
    assert.deepEqual(facets.colors, ["Red", "Blue", "Purple"]);
    assert.deepEqual(facets.types, ["Legend", "Unit", "Gear"]);
    assert.deepEqual(facets.costs, ["0", "2", "10"]);
    assert.deepEqual(facets.powers, ["1"]);
    assert.deepEqual(facets.rams, ["1"]);
    assert.deepEqual(facets.tags, ["alpha", "Zeta"]);
    assert.deepEqual(facets.keywords, ["Blocker"]);
    assert.deepEqual(facets.artists, ["adam", "Orphan", "Zoé"]);
    assert.deepEqual(facets.rarities, ["Common", "Secret", "Exotique"]);
    assert.equal(facets.eddiable, true);
    assert.equal(buildFacets([], new Map()).eddiable, false);
  });
});

describe("textes de carte", () => {
  const c = card({ id: "c", name: "Name", canonicalName: "Canonical", rulesText: "English rules" });

  it("printingTitle : nom localisé > canonique > nom > « Carte »", () => {
    assert.equal(printingTitle(c, printing({ id: "p", localizedName: "Nom FR" })), "Nom FR");
    assert.equal(printingTitle(c, printing({ id: "p", localizedName: "" })), "Canonical");
    assert.equal(printingTitle(card({ id: "x", canonicalName: "", name: "N" }), printing({ id: "p" })), "N");
    assert.equal(printingTitle(undefined, printing({ id: "p" })), "Carte");
  });

  it("resolveRulesText : langue de l'interface d'abord, puis tirage, carte, autre tirage", () => {
    const en = printing({ id: "en", printedRulesText: "Printed EN" });
    const fr = printing({ id: "fr", language: "fr", printedRulesText: "Texte FR" });
    const blankFr = printing({ id: "fr2", language: "fr", printedRulesText: "   " });
    assert.deepEqual(resolveRulesText(c, en, [fr], "fr"), { text: "Texte FR", language: "fr", fromOtherPrinting: true });
    assert.deepEqual(resolveRulesText(c, en, [blankFr], "fr"), { text: "Printed EN", language: "en", fromOtherPrinting: false });
    assert.deepEqual(resolveRulesText(c, printing({ id: "x" }), [], "fr"), { text: "English rules", language: "en", fromOtherPrinting: false });
    const noRules = card({ id: "n", rulesText: "  " });
    assert.deepEqual(resolveRulesText(noRules, printing({ id: "x" }), [fr], "de"), { text: "Texte FR", language: "fr", fromOtherPrinting: true });
    assert.deepEqual(resolveRulesText(noRules, printing({ id: "x" }), [], "fr"), { text: "", language: null, fromOtherPrinting: false });
  });
});

describe("formats", () => {
  it("formats français (espaces insécables)", () => {
    assert.equal(formatMoney(1234.5), "1 234,50 €");
    assert.equal(formatMoney(-3), "-3,00 €");
    assert.match(formatMoney(2, "USD"), /^2,00 \$US$/);
    assert.equal(formatInt(1234567), "1 234 567");
    assert.equal(formatPercent(12.345, 1), "12,3 %");
    assert.equal(formatPercent(99.6), "100 %");
    assert.equal(formatPercent(0), "0 %");
  });
});

describe("valeur marché et dépenses", () => {
  it("printingsPriceTotal : prix vide, nul, illisible ou négatif = non coté", () => {
    const result = printingsPriceTotal([
      printing({ id: "1", marketPrice: "1.25" }),
      printing({ id: "2", marketPrice: "2.75" }),
      printing({ id: "3", marketPrice: "" }),
      printing({ id: "4", marketPrice: "0" }),
      printing({ id: "5", marketPrice: "abc" }),
      printing({ id: "6", marketPrice: "-1" }),
      printing({ id: "7", marketPrice: null }),
    ]);
    assert.deepEqual(result, { total: 4, unpriced: 5 });
    assert.deepEqual(printingsPriceTotal([]), { total: 0, unpriced: 0 });
  });

  it("marketValue : seules les cartes possédées comptent ; sans historique pas de variation", () => {
    const printings = [
      printing({ id: "a", marketPrice: "2", previousMarketPrice: "1" }),
      printing({ id: "b", marketPrice: "5", previousMarketPrice: null }),
      printing({ id: "c", marketPrice: null }),
      printing({ id: "d", marketPrice: "100" }),
    ];
    const value = marketValue(printings, own([["a", 2], ["b", 1], ["c", 3]]));
    assert.deepEqual(value, { total: 9, previousTotal: 7, pricedCopies: 3, unpricedCopies: 3, delta: "up" });
    const noHistory = marketValue(printings, own([["b", 1]]));
    assert.equal(noHistory.previousTotal, null);
    assert.equal(noHistory.delta, "none");
    assert.deepEqual(marketValue([], new Map()), { total: 0, previousTotal: null, pricedCopies: 0, unpricedCopies: 0, delta: "none" });
  });

  it("spentAmount : par devise, EUR par défaut, prix vides / illisibles ignorés", () => {
    const result = spentAmount([
      item({ printingId: "a", quantity: 2, purchasePrice: "1.50" }),
      item({ printingId: "b", quantity: 1, purchasePrice: "3", purchaseCurrency: "EUR" }),
      item({ printingId: "c", quantity: 3, purchasePrice: "2", purchaseCurrency: "USD" }),
      item({ printingId: "d", quantity: 1, purchasePrice: "" }),
      item({ printingId: "e", quantity: 1, purchasePrice: "abc" }),
      item({ printingId: "f", quantity: 1, purchasePrice: null }),
    ]);
    assert.deepEqual(result, { totals: [["EUR", 6], ["USD", 6]], pricedLines: 3 });
    assert.deepEqual(spentAmount([]), { totals: [], pricedLines: 0 });
  });
});

describe("investissement (cas limites)", () => {
  it("priceMovement : seuil au demi-centime, valeurs non finies", async () => {
    const { priceMovement } = await import("../../src/lib/logic");
    assert.equal(priceMovement(1.004, 1), "flat");
    assert.equal(priceMovement(1.006, 1), "up");
    assert.equal(priceMovement(0.994, 1), "down");
    assert.equal(priceMovement(Number.NaN, 1), "none");
    assert.equal(priceMovement(1, Infinity), "none");
    assert.equal(priceMovement(null, null), "none");
    assert.equal(priceMovement(0, 0), "flat");
  });

  it("buildInvestmentLines : lignes orphelines ignorées, P&L seulement en EUR, tri naturel", () => {
    const cards = new Map([["c", card({ id: "c", name: "Carte" })]]);
    const printings = [
      printing({ id: "p2", cardId: "c", collectorNumber: "2", marketPrice: "3", previousMarketPrice: "3" }),
      printing({ id: "p10", cardId: "c", collectorNumber: "10", marketPrice: "", previousMarketPrice: null }),
      printing({ id: "orphan-card", cardId: "inconnue", collectorNumber: "1" }),
    ];
    const lines = buildInvestmentLines(
      [
        item({ id: "usd", printingId: "p2", quantity: 2, purchasePrice: "1", purchaseCurrency: "USD" }),
        item({ id: "noprice", printingId: "p10", quantity: 1, purchasePrice: "4" }),
        item({ id: "zero", printingId: "p2", quantity: 0 }),
        item({ id: "missing", printingId: "absente", quantity: 1 }),
        item({ id: "orphan", printingId: "orphan-card", quantity: 1 }),
      ],
      printings,
      cards,
    );
    assert.deepEqual(lines.map((l) => l.itemId), ["usd", "noprice"]);
    const [usd, noprice] = lines;
    assert.equal(usd.marketTotal, 6);
    assert.equal(usd.profit, null, "achat en USD : pas de P&L en euros");
    assert.equal(usd.marketDelta, "flat");
    assert.equal(noprice.purchaseCurrency, "EUR");
    assert.equal(noprice.marketUnit, null);
    assert.equal(noprice.profit, null);
    assert.equal(noprice.marketDelta, "none");
  });

  it("summarizeInvestment : liste vide et achats non EUR", () => {
    assert.deepEqual(summarizeInvestment([]), {
      marketTotal: 0,
      previousMarketTotal: null,
      marketDelta: "none",
      marketDeltaAmount: null,
      investedEur: 0,
      profitEur: null,
      copies: 0,
      pricedCopies: 0,
      trackedProfitCopies: 0,
    });
    const summary = summarizeInvestment([
      line({ itemId: "a", quantity: 2, purchaseTotal: 10, purchaseCurrency: "USD" }),
      line({ itemId: "b", quantity: 1, marketTotal: 4, marketUnit: 4, previousMarketUnit: 5, purchaseTotal: 3, purchaseCurrency: "EUR", profit: 1 }),
    ]);
    assert.equal(summary.copies, 3);
    assert.equal(summary.pricedCopies, 1);
    assert.equal(summary.investedEur, 3);
    assert.equal(summary.profitEur, 1);
    assert.equal(summary.trackedProfitCopies, 1);
    assert.equal(summary.marketDelta, "down");
    assert.equal(summary.marketDeltaAmount, -1);
  });

  it("investmentBySet : sets sans copie exclus, set inconnu en dernier", () => {
    const result = investmentBySet(
      [
        line({ itemId: "1", setCode: "inconnu", setName: "Inconnu", quantity: 1, marketTotal: 2, marketUnit: 2 }),
        line({ itemId: "2", setCode: "b", setName: "B", quantity: 3, purchaseTotal: 6, purchaseCurrency: "EUR", profit: -1 }),
      ],
      [set({ code: "a", sortOrder: 0 }), set({ code: "b", name: "B", sortOrder: 5 })],
    );
    assert.deepEqual(result.map((r) => r.setCode), ["b", "inconnu"]);
    assert.equal(result[0].investedLines, 1);
    assert.equal(result[0].profitEur, -1);
    assert.equal(result[0].marketDelta, "none");
    assert.equal(result[1].sortOrder, 9999);
    assert.equal(result[1].profitEur, null);
    assert.deepEqual(investmentBySet([], [set({ code: "a" })]), []);
  });

  it("filterInvestmentLines : seuils de P&L, langue, groupe scellé, recherche sans accents", () => {
    const lines = [
      line({ itemId: "gain", profit: 0.005, title: "Rôdeur" }),
      line({ itemId: "neutre", profit: 0.004 }),
      line({ itemId: "neutre-neg", profit: -0.004, language: "fr" }),
      line({ itemId: "perte", profit: -0.005, marketDelta: "down" }),
      line({ itemId: "inconnu", setCode: "sealed-box" }),
    ];
    const run = (partial: Partial<Parameters<typeof filterInvestmentLines>[1]>) =>
      filterInvestmentLines(lines, { set: "all", language: "", performance: "all", q: "", ...partial }).map((l) => l.itemId);
    assert.deepEqual(run({ performance: "profit" }), ["gain"]);
    assert.deepEqual(run({ performance: "flat" }), ["neutre", "neutre-neg"]);
    assert.deepEqual(run({ performance: "loss" }), ["perte"]);
    assert.deepEqual(run({ performance: "unknown" }), ["inconnu"]);
    assert.deepEqual(run({ performance: "falling" }), ["perte"]);
    assert.deepEqual(run({ language: "fr" }), ["neutre-neg"]);
    assert.deepEqual(run({ set: "group:sealed" }), ["inconnu"]);
    assert.equal(run({ set: "group:cards" }).includes("inconnu"), false);
    assert.deepEqual(run({ q: "RODEUR" }), ["gain"]);
    assert.equal(run({ q: "   " }).length, lines.length);
  });

  it("applyInvestmentPeriod : référence de période, lignes ajoutées pendant la période, sans achat", () => {
    const lines = [
      line({ itemId: "old", printingId: "p", quantity: 2, marketUnit: 10, profit: 8, purchaseCurrency: "EUR" }),
      line({ itemId: "new", printingId: "p", quantity: 1, marketUnit: 10, profit: 3, purchaseCurrency: "EUR" }),
      line({ itemId: "nopurchase", printingId: "p", quantity: 1, marketUnit: 10, profit: null }),
      line({ itemId: "noref", printingId: "q", quantity: 1, marketUnit: 10, profit: 2, purchaseCurrency: "EUR" }),
    ];
    const added = new Map([
      ["old", "2026-01-01T10:00:00.000Z"],
      ["new", "2026-06-15T10:00:00.000Z"],
      ["nopurchase", "2026-01-01T10:00:00.000Z"],
      ["noref", "2026-01-01T10:00:00.000Z"],
    ]);
    const result = applyInvestmentPeriod(lines, { p: 7 }, "2026-06-01", added);
    const byId = new Map(result.map((l) => [l.itemId, l]));
    assert.equal(byId.get("old")?.profit, 6, "(10 - 7) × 2");
    assert.equal(byId.get("old")?.previousMarketUnit, 7);
    assert.equal(byId.get("old")?.marketDelta, "up");
    assert.equal(byId.get("new")?.profit, 3, "ajoutée pendant la période : P&L d'achat");
    assert.equal(byId.get("nopurchase")?.profit, null);
    assert.equal(byId.get("noref")?.profit, null);
    assert.equal(byId.get("noref")?.marketDelta, "none");

    // Toute la période : P&L d'achat inchangé, seule la référence change.
    const all = applyInvestmentPeriod(lines, { p: 12 }, null, added);
    assert.deepEqual(all.map((l) => l.profit), [8, 3, null, 2]);
    assert.equal(all[0].marketDelta, "down");
    // Référence non finie ignorée ; l'entrée n'est pas modifiée.
    assert.equal(applyInvestmentPeriod(lines, { p: Number.NaN }, null, added)[0].previousMarketUnit, null);
    assert.equal(lines[0].previousMarketUnit, null);
    assert.equal(lines[0].profit, 8);
  });
});
