import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { alternatePath, languageAlternates, localizedPath, routeOfPath } from "../../src/lib/seo/routes";

describe("seo : routes localisées", () => {
  const pairs: [string, string][] = [
    ["/", "/en"],
    ["/cartes", "/en/cards"],
    ["/cartes/v-streetkid", "/en/cards/v-streetkid"],
    ["/comment-jouer", "/en/how-to-play"],
    ["/tournois/publics", "/en/tournaments"],
    ["/tournois/publics/abc123", "/en/tournaments/abc123"],
    ["/boutiques", "/en/shops"],
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
    assert.equal(alternatePath("/tournois/publics", "?country=FR&period=week", "en"), "/en/tournaments?country=FR&period=week");
    assert.equal(localizedPath("cards", "en", {}, new URLSearchParams({ color: "red" })), "/en/cards?color=red");
  });

  it("ignore la barre finale", () => {
    assert.equal(routeOfPath("/cartes/")?.key, "cards");
  });

  it("ne localise pas l'application ni les pages légales", () => {
    for (const path of ["/cards", "/decks", "/tournois", "/tournois/abc", "/mentions-legales", "/en/decks", "/classeur/x"]) {
      assert.equal(routeOfPath(path), null, path);
      assert.equal(alternatePath(path, null, "en"), null, path);
    }
  });

  it("déclare fr, en et x-default", () => {
    assert.deepEqual(languageAlternates("card", { slug: "v-streetkid" }), {
      fr: "/cartes/v-streetkid",
      en: "/en/cards/v-streetkid",
      "x-default": "/cartes/v-streetkid",
    });
  });
});
