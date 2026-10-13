import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { alternatePath, landingSectionPath, languageAlternates, localizedPath, routeOfPath } from "../../src/lib/seo/routes";

describe("seo : routes localisées", () => {
  const pairs: [string, string][] = [
    ["/", "/en"],
    ["/cartes/v-streetkid", "/en/cards/v-streetkid"],
    ["/tournois/publics/abc123", "/en/tournaments/abc123"],
    ["/boutiques/arasaka-games", "/en/shops/arasaka-games"],
  ];

  it("fait correspondre chaque page dans les deux sens", () => {
    for (const [fr, en] of pairs) {
      assert.equal(alternatePath(fr, null, "en"), en, fr);
      assert.equal(alternatePath(en, null, "fr"), fr, en);
      assert.equal(routeOfPath(fr)?.locale, "fr");
      assert.equal(routeOfPath(en)?.locale, "en");
    }
  });

  it("extrait et réencode les paramètres dynamiques", () => {
    assert.deepEqual(routeOfPath("/en/shops/arasaka-games"), { key: "shop", locale: "en", params: { slug: "arasaka-games" } });
    assert.equal(localizedPath("card", "fr", { slug: "a b" }), "/cartes/a%20b");
    assert.deepEqual(routeOfPath("/cartes/a%20b")?.params, { slug: "a b" });
  });

  it("conserve la query", () => {
    assert.equal(alternatePath("/boutiques/x", "?view=map", "en"), "/en/shops/x?view=map");
    assert.equal(localizedPath("home", "en", {}, new URLSearchParams({ ref: "a" })), "/en?ref=a");
  });

  it("ignore la barre finale", () => {
    assert.equal(routeOfPath("/cartes/v/")?.key, "card");
  });

  it("ne localise pas l'application ni les pages légales", () => {
    // Annuaires et règles : réservés aux comptes, les visiteurs les trouvent sur l'accueil.
    for (const path of ["/cards", "/decks", "/tournois", "/tournois/abc", "/mentions-legales", "/en/decks", "/classeur/x", "/cartes", "/tournois/publics", "/boutiques", "/comment-jouer"]) {
      assert.equal(routeOfPath(path), null, path);
      assert.equal(alternatePath(path, null, "en"), null, path);
    }
  });

  it("ancres des annuaires sur l'accueil", () => {
    assert.equal(landingSectionPath("tournaments", "fr"), "/#tournois");
    assert.equal(landingSectionPath("shops", "en"), "/en#shops");
  });

  it("déclare fr, en et x-default", () => {
    assert.deepEqual(languageAlternates("card", { slug: "v-streetkid" }), {
      fr: "/cartes/v-streetkid",
      en: "/en/cards/v-streetkid",
      "x-default": "/cartes/v-streetkid",
    });
  });
});
