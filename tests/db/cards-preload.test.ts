/**
 * Préchargement des premières images de la collection : même ordre que la grille, rien quand l'ordre
 * dépend de la collection de l'utilisateur. Sur le vrai catalogue (base SQLite locale, lecture seule).
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { firstGridImages } from "../../src/lib/cards-preload";
import { loadCatalog } from "../../src/lib/catalog";
import { alignReleasedFilters, browseChecklist, filterPrintings, parseFilters, sortPrintings } from "../../src/lib/logic";
import { DEFAULT_PREFERENCES, parseCardsViewCookie } from "../../src/lib/preferences";
import { thumbnailPath, thumbnailSrcSet } from "../../src/lib/card-image";
import { prisma } from "../../src/lib/prisma";
import type { CatalogDTO } from "../../src/lib/types";
import { assertFullCatalog } from "../helpers/catalog";

// Lecture seule du catalogue local : rien n'est écrit en base.
let catalog: CatalogDTO;
beforeAll(async () => {
  await assertFullCatalog();
  catalog = await loadCatalog();
});
afterAll(() => prisma.$disconnect());
const defaults = { sort: DEFAULT_PREFERENCES.sort, collection: DEFAULT_PREFERENCES.collection };

/** Ordre affiché par la grille (calcul de CardsExplorer), sans collection. */
function gridOrder(params: URLSearchParams, view = defaults) {
  const filters = alignReleasedFilters(parseFilters(params, true, view));
  const cards = new Map(catalog.cards.map((card) => [card.id, card]));
  const sets = new Map(catalog.sets.map((set) => [set.code, set]));
  const matched = filterPrintings(catalog.printings, cards, new Map(), filters, browseChecklist(catalog.printings, filters.set));
  return sortPrintings(matched, cards, new Map(), sets, filters.sort, { q: filters.q, defaultSort: view.sort });
}

const images = (list: ReturnType<typeof gridOrder>) =>
  list.flatMap(({ imagePath }) =>
    imagePath ? [{ href: thumbnailPath(imagePath) ?? imagePath, srcSet: thumbnailSrcSet(imagePath) }] : [],
  );

describe("firstGridImages", () => {
  it("rend les 4 premières images de la grille par défaut, dans l'ordre", () => {
    const result = firstGridImages(catalog, new URLSearchParams(), defaults, 4);
    assert.equal(result.length, 4);
    assert.deepEqual(result, images(gridOrder(new URLSearchParams()).slice(0, 4)));
    // Même srcset que la tuile : sans lui, le navigateur choisirait une autre largeur que celle préchargée.
    assert.ok(result.every((image) => image.srcSet?.includes(`${image.href} 400w`)));
  });

  it("suit les paramètres de l'URL et le tri choisi", () => {
    const params = new URLSearchParams("sort=name-desc");
    assert.deepEqual(firstGridImages(catalog, params, defaults, 4), images(gridOrder(params).slice(0, 4)));
    const view = { sort: "price-desc" as const, collection: "all" as const };
    assert.deepEqual(
      firstGridImages(catalog, new URLSearchParams(), view, 4),
      images(gridOrder(new URLSearchParams(), view).slice(0, 4)),
    );
  });

  it("ne précharge rien quand l'ordre dépend de la collection", () => {
    assert.deepEqual(firstGridImages(catalog, new URLSearchParams("collection=owned"), defaults, 4), []);
    assert.deepEqual(firstGridImages(catalog, new URLSearchParams(), { sort: "owned-first", collection: "all" }, 4), []);
    assert.deepEqual(firstGridImages(catalog, new URLSearchParams(), { sort: "qty-desc", collection: "all" }, 4), []);
  });
});

describe("parseCardsViewCookie", () => {
  it("lit le tri et le filtre, et revient aux défauts si le cookie est absent ou invalide", () => {
    assert.deepEqual(parseCardsViewCookie("name-asc~missing"), { sort: "name-asc", collection: "missing" });
    assert.deepEqual(parseCardsViewCookie(undefined), defaults);
    assert.deepEqual(parseCardsViewCookie("n'importe~quoi"), defaults);
  });
});
