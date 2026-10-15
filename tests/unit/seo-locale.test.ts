import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { matchRoute, splitLocale } from "../../src/i18n/match";

/** La langue d'une page est celle de son URL, sur toutes les pages : la préférence n'y joue aucun rôle. */
describe("seo : langue imposée par l'URL", () => {
  it("URL française (sans préfixe) : français", () => {
    assert.equal(matchRoute("/cartes/v-streetkid")?.locale, "fr");
  });

  it("URL anglaise : anglais", () => {
    assert.deepEqual(matchRoute("/en/shops/arasaka"), { locale: "en", route: "/boutiques/[slug]", params: { slug: "arasaka" } });
  });

  it("URL italienne : italien", () => {
    assert.equal(matchRoute("/it/carte/v-streetkid")?.locale, "it");
  });

  it("écrans de l'application : français sans préfixe, autre langue sous son préfixe", () => {
    assert.deepEqual(matchRoute("/decks"), { locale: "fr", route: "/decks", params: {} });
    assert.deepEqual(matchRoute("/it/decks"), { locale: "it", route: "/decks", params: {} });
  });

  it("pages légales : URL traduite de chaque langue", () => {
    assert.equal(matchRoute("/cgu")?.locale, "fr");
    assert.deepEqual(matchRoute("/de/impressum"), { locale: "de", route: "/mentions-legales", params: {} });
  });

  it("accueil", () => {
    assert.deepEqual(splitLocale("/"), { locale: "fr", rest: "/", prefixed: false });
    assert.deepEqual(splitLocale("/es"), { locale: "es", rest: "/", prefixed: true });
    assert.equal(matchRoute("/es")?.route, "/");
  });

  it("préfixe de langue inconnu : aucune page", () => {
    assert.equal(matchRoute("/nl/cards"), null);
  });
});
