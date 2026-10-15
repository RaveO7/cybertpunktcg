import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { LOCALES, type Locale } from "../../src/i18n/config";
import { formatRoute, matchRoute } from "../../src/i18n/match";
import {
  alternatePath,
  landingSectionPath,
  languageAlternates,
  localizedPath,
  publicRouteOfPath,
  routePath,
} from "../../src/i18n/paths";
import { pathnames, type AppPathname } from "../../src/i18n/routing";

describe("seo : routes localisées", () => {
  // Même page dans chaque langue : fr, en, de, es, it.
  const pages: Record<Locale, string>[] = [
    { fr: "/", en: "/en", de: "/de", es: "/es", it: "/it" },
    { fr: "/cartes", en: "/en/cards", de: "/de/karten", es: "/es/cartas", it: "/it/carte" },
    {
      fr: "/cartes/v-streetkid",
      en: "/en/cards/v-streetkid",
      de: "/de/karten/v-streetkid",
      es: "/es/cartas/v-streetkid",
      it: "/it/carte/v-streetkid",
    },
    {
      fr: "/tournois/publics/abc123",
      en: "/en/tournaments/abc123",
      de: "/de/turniere/abc123",
      es: "/es/torneos/abc123",
      it: "/it/tornei/abc123",
    },
    {
      fr: "/boutiques/arasaka-games",
      en: "/en/shops/arasaka-games",
      de: "/de/shops/arasaka-games",
      es: "/es/tiendas/arasaka-games",
      it: "/it/negozi/arasaka-games",
    },
    { fr: "/cgu", en: "/en/terms", de: "/de/nutzungsbedingungen", es: "/es/condiciones", it: "/it/termini" },
  ];

  it("fait correspondre chaque page dans toutes les langues", () => {
    for (const page of pages) {
      for (const from of LOCALES) {
        assert.equal(publicRouteOfPath(page[from])?.locale, from, page[from]);
        for (const to of LOCALES) assert.equal(alternatePath(page[from], null, to), page[to], `${page[from]} → ${to}`);
      }
    }
  });

  it("extrait et réencode les paramètres dynamiques", () => {
    assert.deepEqual(publicRouteOfPath("/en/shops/arasaka-games"), { key: "shop", locale: "en", params: { slug: "arasaka-games" } });
    assert.equal(localizedPath("card", "fr", { slug: "a b" }), "/cartes/a%20b");
    assert.deepEqual(publicRouteOfPath("/cartes/a%20b")?.params, { slug: "a b" });
  });

  it("conserve la query", () => {
    assert.equal(alternatePath("/boutiques/x", "?view=map", "en"), "/en/shops/x?view=map");
    assert.equal(localizedPath("home", "en", {}, new URLSearchParams({ ref: "a" })), "/en?ref=a");
    assert.equal(alternatePath("/tournois/publics", "?country=FR", "en"), "/en/tournois/publics?country=FR");
  });

  it("ignore la barre finale", () => {
    assert.equal(publicRouteOfPath("/cartes/v/")?.key, "card");
  });

  it("localise aussi les écrans de l'application, sans en faire des pages publiques", () => {
    assert.equal(alternatePath("/decks", null, "de"), "/de/decks");
    assert.equal(alternatePath("/de/decks", null, "fr"), "/decks");
    assert.equal(alternatePath("/tournois/abc", null, "it"), "/it/tournois/abc");
    for (const path of ["/cards", "/decks", "/tournois", "/tournois/abc", "/classeur/x", "/tournois/publics", "/boutiques", "/comment-jouer"]) {
      assert.equal(publicRouteOfPath(path), null, path);
    }
  });

  it("explorateur : /cards en français, /<langue>/explorer ailleurs ; /en/cards reste la liste publique", () => {
    assert.equal(alternatePath("/cards", null, "en"), "/en/explorer");
    assert.equal(alternatePath("/en/explorer", "?q=v", "fr"), "/cards?q=v");
    assert.equal(publicRouteOfPath("/en/cards")?.key, "cards");
    assert.equal(matchRoute("/cards")?.route, "/cards");
  });

  it("URL inconnue : aucune correspondance", () => {
    assert.equal(alternatePath("/nl/cards", null, "fr"), null);
    assert.equal(alternatePath("/de/cards/v", null, "fr"), null);
  });

  it("ancres des annuaires sur l'accueil", () => {
    assert.equal(landingSectionPath("tournaments", "fr"), "/#tournois");
    assert.equal(landingSectionPath("shops", "en"), "/en#shops");
    assert.equal(landingSectionPath("tournaments", "it"), "/it#tornei");
  });

  it("déclare les cinq langues et x-default", () => {
    assert.deepEqual(languageAlternates("card", { slug: "v-streetkid" }), {
      fr: "/cartes/v-streetkid",
      en: "/en/cards/v-streetkid",
      de: "/de/karten/v-streetkid",
      es: "/es/cartas/v-streetkid",
      it: "/it/carte/v-streetkid",
      "x-default": "/cartes/v-streetkid",
    });
  });

  it("le formateur du proxy donne les mêmes URL que next-intl", () => {
    for (const route of Object.keys(pathnames) as AppPathname[]) {
      const params = Object.fromEntries([...route.matchAll(/\[(\w+)\]/g)].map(([, name]) => [name, "x y"]));
      for (const locale of LOCALES) assert.equal(formatRoute(route, locale, params), routePath(route, locale, params), `${route} ${locale}`);
    }
  });
});
