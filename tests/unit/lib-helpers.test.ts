import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import { afterEach, describe, it, vi } from "vitest";
import { CURRENCIES } from "../../src/lib/parse";
import { conditionOptionLabel } from "../../src/lib/condition-label";
import {
  ICONIC_GRADIENT,
  ICONIC_GRADIENT_SOFT,
  isIconicRarity,
  rarityColor,
  rarityFill,
} from "../../src/lib/rarity-color";
import { CARD_IMAGES_PREFIX, THUMB_DIR, thumbnailPath } from "../../src/lib/card-image";
import {
  ALL_SETS_ID,
  BETA_SET_CODE,
  BLOCKS,
  CARDS_GROUP_FILTER,
  CONDITIONS,
  FRENCH_SOURCE_SET_CODE,
  LANGUAGE_LABELS,
  MAIN_SET_CODE,
  PRICE_SOURCES,
  RARITY_ORDER,
  SEALED_GROUP_FILTER,
  isSealedSetCode,
  matchesSetFilter,
  partitionCatalogSets,
} from "../../src/lib/reference-data";
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  filterDefaultsFrom,
  normalizePreferences,
  readStoredPreferences,
  writeStoredPreferences,
} from "../../src/lib/preferences";
import { dummyPasswordHash, hashPassword, verifyPassword } from "../../src/lib/password";
import {
  displaySetName,
  extensionsFor,
  gameForSet,
  gamesInCatalog,
  groupExtensions,
  languageLabel,
  languagesFor,
  productGroup,
  scopeKey,
  type DashboardExtension,
} from "../../src/lib/dashboard";
import type { PrintingDTO, SetDTO } from "../../src/lib/types";

const NBSP = " ";

describe("parse", () => {
  it("devises supportées : EUR en premier (devise par défaut), sans doublon", () => {
    assert.equal(CURRENCIES[0], "EUR");
    assert.equal(new Set(CURRENCIES).size, CURRENCIES.length);
    for (const code of CURRENCIES) assert.match(code, /^[A-Z]{3}$/);
  });
});

describe("conditionOptionLabel", () => {
  it("aligne les codes avec des espaces insécables sur le plus long code", () => {
    const labels = CONDITIONS.map((condition) => conditionOptionLabel(condition, [...CONDITIONS]));
    assert.equal(labels[0], `NM${NBSP} — Near Mint`);
    assert.equal(labels[4], "DMG — Damaged");
    // Tous les « — » tombent à la même colonne.
    const columns = new Set(labels.map((label) => label.indexOf("—")));
    assert.equal(columns.size, 1);
    // Aucune espace ordinaire dans le remplissage (le navigateur la fusionnerait).
    for (const label of labels) assert.equal(label.split(" — ")[0].includes(" "), false);
  });

  it("liste vide ou code plus long que la liste : pas de remplissage ni de troncature", () => {
    assert.equal(conditionOptionLabel({ code: "NM", name: "Near Mint" }, []), "NM — Near Mint");
    assert.equal(conditionOptionLabel({ code: "LONGCODE", name: "X" }, [{ code: "NM", name: "" }]), "LONGCODE — X");
  });
});

describe("rarity-color", () => {
  it("chaque rareté connue a une couleur et un fond", () => {
    for (const rarity of RARITY_ORDER) {
      assert.notEqual(rarityColor(rarity), null, rarity);
      assert.notEqual(rarityFill(rarity), null, rarity);
    }
  });

  it("Iconic : dégradé chromé, couleur unie chrome", () => {
    for (const rarity of ["Iconic Legend", "Iconic Other", "Iconic Secret", "Iconic"]) {
      assert.equal(isIconicRarity(rarity), true);
      assert.equal(rarityFill(rarity), ICONIC_GRADIENT);
      assert.equal(rarityColor(rarity), "var(--rarity-chrome)");
    }
    assert.match(ICONIC_GRADIENT, /^linear-gradient\(100deg, var\(--rarity-chrome\), var\(--rarity-nova\), var\(--rarity-chrome\)\)$/);
    assert.equal((ICONIC_GRADIENT_SOFT.match(/color-mix\(in srgb, var\(--rarity-[a-z]+\) 18%, transparent\)/g) ?? []).length, 3);
  });

  it("rareté inconnue ou mal casée → null", () => {
    for (const rarity of ["", "Mythic", "common", "iconic legend", " Rare"]) {
      assert.equal(rarityColor(rarity), null, rarity);
      assert.equal(rarityFill(rarity), null, rarity);
    }
    assert.equal(rarityFill("Rare"), rarityColor("Rare"));
  });

  // Attendu : null pour une rareté inconnue (contrat documenté).
  // Observé : RARITY_COLORS est un objet littéral, donc « constructor » / « toString » renvoient
  // les fonctions héritées d'Object.prototype au lieu de null.
  it.fails("BUG: une rareté nommée comme une clé d'Object.prototype renvoie null", () => {
    assert.equal(rarityColor("constructor"), null);
    assert.equal(rarityColor("toString"), null);
  });
});

describe("thumbnailPath", () => {
  it("dérive la miniature WebP d'une image locale", () => {
    assert.equal(thumbnailPath("/card-images/abc.png"), "/card-images/thumb/abc.webp");
    assert.equal(thumbnailPath("/card-images/abc.webp"), "/card-images/thumb/abc.webp");
    assert.equal(thumbnailPath("/card-images/a.b.jpg"), "/card-images/thumb/a.b.webp");
    assert.equal(thumbnailPath("/card-images/noext"), "/card-images/thumb/noext.webp");
    assert.equal(thumbnailPath("/card-images/abc.png?v=2#x"), "/card-images/thumb/abc.webp");
    assert.equal(thumbnailPath("/card-images/abc.png#frag"), "/card-images/thumb/abc.webp");
    assert.equal(`${CARD_IMAGES_PREFIX}${THUMB_DIR}/`, "/card-images/thumb/");
  });

  it("aucune miniature pour une image distante, absente, imbriquée ou déjà miniature", () => {
    for (const src of [
      null,
      undefined,
      "",
      "/card-images/",
      "/card-images/?v=1",
      "https://cdn.example.com/card-images/abc.png",
      "card-images/abc.png",
      "/other/abc.png",
      "/card-images/thumb/abc.webp",
      "/card-images/sub/abc.png",
      "/card-images/../secret.png",
    ]) {
      assert.equal(thumbnailPath(src), null, String(src));
    }
  });

  it("idempotence : la miniature d'une miniature n'existe pas", () => {
    const thumb = thumbnailPath("/card-images/x.jpg");
    assert.equal(thumbnailPath(thumb), null);
  });
});

describe("reference-data", () => {
  it("le set français source est le jumeau « -fr » du set principal (convention utilisée par logic.ts)", () => {
    assert.equal(FRENCH_SOURCE_SET_CODE, `${MAIN_SET_CODE}-fr`);
  });

  it("le bloc publié contient beta puis retail, sans doublon entre blocs", () => {
    const all = BLOCKS.flatMap((block) => block.sets);
    assert.equal(new Set(all).size, all.length);
    assert.ok(all.includes(BETA_SET_CODE) && all.includes(MAIN_SET_CODE));
    assert.ok(all.indexOf(BETA_SET_CODE) < all.indexOf(MAIN_SET_CODE));
    for (const code of all) {
      assert.equal(isSealedSetCode(code), false);
      assert.equal(code.endsWith("-fr"), false, "un bloc liste le code anglais");
    }
  });

  it("états : codes uniques, ordre de tri strictement croissant, NM en tête", () => {
    assert.equal(CONDITIONS[0].code, "NM");
    assert.equal(new Set(CONDITIONS.map((c) => c.code)).size, CONDITIONS.length);
    for (let i = 1; i < CONDITIONS.length; i += 1) assert.ok(CONDITIONS[i].sortOrder > CONDITIONS[i - 1].sortOrder);
    assert.equal(new Set(PRICE_SOURCES.map((s) => s.code)).size, PRICE_SOURCES.length);
    assert.equal(new Set(RARITY_ORDER).size, RARITY_ORDER.length);
  });

  it("matchesSetFilter : tout, groupe cartes, groupe scellé, set exact", () => {
    assert.equal(matchesSetFilter("x", undefined), true);
    assert.equal(matchesSetFilter("x", ""), true);
    assert.equal(matchesSetFilter("sealed-box", ALL_SETS_ID), true);
    assert.equal(matchesSetFilter("welcometonightcitybeta", CARDS_GROUP_FILTER), true);
    assert.equal(matchesSetFilter("sealed-box", CARDS_GROUP_FILTER), false);
    assert.equal(matchesSetFilter("sealed-box", SEALED_GROUP_FILTER), true);
    assert.equal(matchesSetFilter("welcometonightcitybeta", SEALED_GROUP_FILTER), false);
    assert.equal(matchesSetFilter("a", "a"), true);
    assert.equal(matchesSetFilter("a", "b"), false);
    // Préfixe sensible à la casse et ancré au début.
    assert.equal(isSealedSetCode("Sealed-box"), false);
    assert.equal(isSealedSetCode("x-sealed-box"), false);
  });

  it("partitionCatalogSets : cartes dans l'ordre reçu, scellé trié, entrée intacte", () => {
    const sets = [
      { code: "sealed-b", sortOrder: 5 },
      { code: "z", sortOrder: 9 },
      { code: "sealed-a", sortOrder: 1 },
      { code: "a", sortOrder: 0 },
    ];
    const copy = structuredClone(sets);
    const { cardSets, sealedSets } = partitionCatalogSets(sets);
    assert.deepEqual(cardSets.map((s) => s.code), ["z", "a"]);
    assert.deepEqual(sealedSets.map((s) => s.code), ["sealed-a", "sealed-b"]);
    assert.deepEqual(sets, copy);
    assert.deepEqual(partitionCatalogSets([]), { cardSets: [], sealedSets: [] });
  });
});

describe("preferences", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("valeur absente ou non objet → défauts (copie, jamais la référence partagée)", () => {
    for (const raw of [null, undefined, "dark", 42, true]) {
      assert.deepEqual(normalizePreferences(raw), DEFAULT_PREFERENCES);
    }
    const prefs = normalizePreferences(null);
    assert.notEqual(prefs, DEFAULT_PREFERENCES);
    prefs.theme = "light";
    assert.equal(DEFAULT_PREFERENCES.theme, "dark");
  });

  it("garde les valeurs valides et remplace chaque valeur invalide indépendamment", () => {
    const valid = { theme: "light", currency: "USD", condition: "LP", sort: "rarity", collection: "missing", filtersPanel: "closed" };
    assert.deepEqual(normalizePreferences(valid), valid);
    const mixed = normalizePreferences({ ...valid, currency: "JPY", condition: "lp", sort: "price", extra: 1 });
    assert.deepEqual(mixed, { ...valid, currency: "EUR", condition: "NM", sort: "number-asc" });
    assert.equal("extra" in mixed, false);
  });

  it("résiste aux clés héritées et aux types inattendus", () => {
    const prefs = normalizePreferences({ theme: "constructor", currency: "toString", condition: "__proto__", sort: ["rarity"], collection: 1, filtersPanel: null });
    assert.deepEqual(prefs, DEFAULT_PREFERENCES);
  });

  it("accepte toutes les devises et tous les états de référence", () => {
    for (const currency of CURRENCIES) assert.equal(normalizePreferences({ currency }).currency, currency);
    for (const { code } of CONDITIONS) assert.equal(normalizePreferences({ condition: code }).condition, code);
  });

  it("lecture / écriture sans navigateur (SSR) : défauts, aucune exception", () => {
    assert.deepEqual(readStoredPreferences(), DEFAULT_PREFERENCES);
    writeStoredPreferences(DEFAULT_PREFERENCES);
  });

  it("aller-retour via localStorage, JSON corrompu et quota plein", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
    });
    const prefs = { ...DEFAULT_PREFERENCES, theme: "light" as const, sort: "set" as const };
    writeStoredPreferences(prefs);
    assert.ok(store.has(PREFERENCES_STORAGE_KEY));
    assert.deepEqual(readStoredPreferences(), prefs);
    store.set(PREFERENCES_STORAGE_KEY, "{corrompu");
    assert.deepEqual(readStoredPreferences(), DEFAULT_PREFERENCES);
    store.set(PREFERENCES_STORAGE_KEY, "null");
    assert.deepEqual(readStoredPreferences(), DEFAULT_PREFERENCES);

    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("SecurityError");
        },
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
    });
    assert.deepEqual(readStoredPreferences(), DEFAULT_PREFERENCES);
    writeStoredPreferences(prefs);
  });

  it("filterDefaultsFrom ne garde que tri et filtre de collection", () => {
    assert.deepEqual(filterDefaultsFrom({ ...DEFAULT_PREFERENCES, sort: "name-desc", collection: "owned" }), {
      sort: "name-desc",
      collection: "owned",
    });
  });
});

describe("password (partie pure)", () => {
  it("stockage en clair : le « hash » est le mot de passe", async () => {
    assert.equal(await hashPassword("s3cret pass"), "s3cret pass");
  });

  it("vérifie un mot de passe en clair, sensible à la casse et à la longueur", async () => {
    assert.equal(await verifyPassword("abcdefgh", "abcdefgh"), true);
    assert.equal(await verifyPassword("abcdefgH", "abcdefgh"), false);
    assert.equal(await verifyPassword("abcdefg", "abcdefgh"), false);
    assert.equal(await verifyPassword("abcdefgh ", "abcdefgh"), false);
    assert.equal(await verifyPassword("", "abcdefgh"), false);
    assert.equal(await verifyPassword("mötdépässe€", "mötdépässe€"), true);
    // Même nombre de caractères mais pas d'octets UTF-8 : ne doit pas lever (timingSafeEqual).
    assert.equal(await verifyPassword("é", "ab"), false);
  });

  it("accepte toujours les anciens hash scrypt", async () => {
    const salt = "c2VsLWRlLXRlc3Q";
    const key = scryptSync("ancien-mdp", salt, 64, { N: 16384, r: 8, p: 1 }).toString("base64url");
    const stored = `scrypt$${salt}$${key}`;
    assert.equal(await verifyPassword("ancien-mdp", stored), true);
    assert.equal(await verifyPassword("ancien-mdP", stored), false);
    // Le hash lui-même n'est pas un mot de passe valide.
    assert.equal(await verifyPassword(stored, stored), false);
  });

  it("hash scrypt mal formé → refus sans exception", async () => {
    for (const stored of ["scrypt$", "scrypt$sel", "scrypt$sel$", "scrypt$$abc", "scrypt$sel$AAAA"]) {
      assert.equal(await verifyPassword("x", stored), false, stored);
    }
  });

  it("le hash factice ne correspond à aucun mot de passe saisissable usuel", async () => {
    const dummy = await dummyPasswordHash();
    assert.equal(dummy.startsWith("scrypt$"), false);
    assert.equal(await verifyPassword("", dummy), false);
    assert.equal(await verifyPassword("dummy-password-not-used", dummy), false);
  });
});

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

function printing(id: string, setCode: string, language = "en"): PrintingDTO {
  return {
    id,
    cardId: id,
    externalId: id,
    setCode,
    setName: setCode,
    collectorNumber: "001",
    rarity: null,
    language,
    localizedName: null,
    imagePath: null,
    artist: null,
    printedRulesText: null,
    officialFinish: null,
    marketPrice: null,
    previousMarketPrice: null,
  };
}

describe("dashboard", () => {
  it("productGroup : scellé, promos, decks, annexes, événements, extensions", () => {
    const cases: [string, string | undefined, string][] = [
      ["Booster Box", "sealed-box", "Scellé"],
      ["Promo Pack", undefined, "Promos"],
      ["Promo Deck", undefined, "Promos"],
      ["Starter Deck: Arasaka", undefined, "Decks"],
      ["Demo Deck", undefined, "Decks"],
      ["Theme Deck", undefined, "Decks"],
      ["Deckbuilder's Guide", undefined, "Extensions"],
      ["Booster Topper", undefined, "Produits annexes"],
      ["Pre-release Kit", undefined, "Événements"],
      ["Prerelease Kit", undefined, "Événements"],
      ["Pre release", undefined, "Événements"],
      ["Night City Open", undefined, "Événements"],
      ["Store Brawl", undefined, "Événements"],
      ["Showdown 2026", undefined, "Événements"],
      ["Opening Night", undefined, "Extensions"],
      ["Welcome to Night City", "welcometonightcityretail", "Extensions"],
    ];
    for (const [name, code, expected] of cases) assert.equal(productGroup(name, code), expected, name);
  });

  // Attendu : « demo » désigne un deck de démo ; un nom d'extension qui contient ces lettres
  // (Demolition, Demon…) reste une extension, comme pour « deck » testé avec \b.
  // Observé : value.includes("demo") classe ces extensions dans « Decks ».
  it.fails("BUG: une extension dont le nom contient « demo » (Demolition) reste une extension", () => {
    assert.equal(productGroup("Demolition Crew"), "Extensions");
  });

  it("displaySetName retire le suffixe FR uniquement en français", () => {
    assert.equal(displaySetName("Welcome to Night City — FR", "fr"), "Welcome to Night City");
    assert.equal(displaySetName("Welcome to Night City - FR", "fr"), "Welcome to Night City");
    assert.equal(displaySetName("Welcome to Night City – fr ", "fr"), "Welcome to Night City");
    assert.equal(displaySetName("Welcome to Night City FR", "fr"), "Welcome to Night City");
    assert.equal(displaySetName("Welcome to Night City — FR", "en"), "Welcome to Night City — FR");
    assert.equal(displaySetName("Neon FRONTIER", "fr"), "Neon FRONTIER");
    assert.equal(displaySetName("FR", "fr"), "FR");
  });

  it("languageLabel et scopeKey", () => {
    assert.equal(languageLabel(""), "Toutes les langues");
    assert.equal(languageLabel("fr"), LANGUAGE_LABELS.fr);
    assert.equal(languageLabel("de"), "de");
    assert.equal(scopeKey("cyberpunk", "fr"), "cyberpunk:fr");
  });

  // Attendu : code langue inconnu → le code lui-même. Observé : la fonction héritée d'Object.prototype.
  it.fails("BUG: languageLabel d'un code nommé comme une clé d'Object.prototype renvoie ce code", () => {
    assert.equal(languageLabel("constructor"), "constructor");
  });

  it("gameForSet retombe sur le dernier jeu", () => {
    assert.equal(gameForSet({ code: "inconnu", name: "?" }).id, "cyberpunk");
  });

  it("gamesInCatalog ignore les sets sans impression et le scellé", () => {
    const sets = [set({ code: "a" }), set({ code: "sealed-x" }), set({ code: "vide" })];
    assert.deepEqual(gamesInCatalog(sets, [printing("1", "a"), printing("2", "sealed-x")]), [{ id: "cyberpunk", name: "Cyberpunk TCG" }]);
    assert.deepEqual(gamesInCatalog(sets, [printing("2", "sealed-x")]), []);
    assert.deepEqual(gamesInCatalog([], []), []);
  });

  it("languagesFor : en, fr d'abord puis ordre alphabétique, limité aux sets demandés", () => {
    const printings = [
      printing("1", "a", "it"),
      printing("2", "a", "fr"),
      printing("3", "a", "de"),
      printing("4", "a", "en"),
      printing("5", "b", "es"),
    ];
    assert.deepEqual(languagesFor(printings, new Set(["a"])), ["en", "fr", "de", "it"]);
    assert.deepEqual(languagesFor(printings, new Set(["b"])), ["es"]);
    assert.deepEqual(languagesFor(printings, new Set()), []);
  });

  it("extensionsFor : compte par langue, exclut scellé et sets vides, trie par taille", () => {
    const sets = [
      set({ code: "small", name: "Small", sortOrder: 1 }),
      set({ code: "big", name: "Big Set — FR", sortOrder: 2 }),
      set({ code: "tie-b", name: "B", sortOrder: 3 }),
      set({ code: "tie-a", name: "A", sortOrder: 3 }),
      set({ code: "sealed-x", name: "Box", sortOrder: 0 }),
      set({ code: "empty", name: "Empty", sortOrder: 0 }),
    ];
    const printings = [
      printing("1", "small", "fr"),
      printing("2", "big", "fr"),
      printing("3", "big", "fr"),
      printing("4", "big", "en"),
      printing("5", "tie-b", "fr"),
      printing("6", "tie-a", "fr"),
      printing("7", "sealed-x", "fr"),
      printing("8", "sealed-x", "fr"),
      printing("9", "sealed-x", "fr"),
    ];
    const result = extensionsFor(sets, printings, "cyberpunk", "fr");
    assert.deepEqual(
      result.map((e) => [e.code, e.total]),
      [
        ["big", 2],
        ["small", 1],
        ["tie-a", 1],
        ["tie-b", 1],
      ],
    );
    assert.equal(result[0].name, "Big Set");
    assert.equal(result[0].language, "fr");
    assert.deepEqual(extensionsFor(sets, printings, "autre-jeu", "fr"), []);
    assert.deepEqual(extensionsFor(sets, printings, "cyberpunk", "it"), []);
  });

  it("groupExtensions : ordre fixe des groupes, groupes inconnus à la fin, ordre interne conservé", () => {
    const ext = (code: string, group: string): DashboardExtension => ({ code, name: code, language: "en", group, sortOrder: 0, total: 1 });
    const grouped = groupExtensions([
      ext("x", "Inconnu"),
      ext("p1", "Promos"),
      ext("e1", "Extensions"),
      ext("s", "Scellé"),
      ext("p2", "Promos"),
      ext("d", "Decks"),
    ]);
    assert.deepEqual(grouped.map((g) => g.group), ["Extensions", "Decks", "Promos", "Scellé", "Inconnu"]);
    assert.deepEqual(grouped[2].extensions.map((e) => e.code), ["p1", "p2"]);
    assert.deepEqual(groupExtensions([]), []);
  });
});
