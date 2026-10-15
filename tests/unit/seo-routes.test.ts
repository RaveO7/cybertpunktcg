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
    { fr: "/fr", en: "/en", de: "/de", es: "/es", it: "/it" },
    { fr: "/fr/cartes", en: "/en/cards", de: "/de/karten", es: "/es/cartas", it: "/it/carte" },
    {
      fr: "/fr/cartes/v-streetkid",
      en: "/en/cards/v-streetkid",
      de: "/de/karten/v-streetkid",
      es: "/es/cartas/v-streetkid",
      it: "/it/carte/v-streetkid",
    },
    {
      fr: "/fr/tournois/publics/abc123",
      en: "/en/tournaments/abc123",
      de: "/de/turniere/abc123",
      es: "/es/torneos/abc123",
      it: "/it/tornei/abc123",
    },
    {
      fr: "/fr/boutiques/arasaka-games",
      en: "/en/shops/arasaka-games",
      de: "/de/shops/arasaka-games",
      es: "/es/tiendas/arasaka-games",
      it: "/it/negozi/arasaka-games",
    },
    { fr: "/fr/cgu", en: "/en/terms", de: "/de/nutzungsbedingungen", es: "/es/condiciones", it: "/it/termini" },
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
    assert.equal(localizedPath("card", "fr", { slug: "a b" }), "/fr/cartes/a%20b");
    assert.deepEqual(publicRouteOfPath("/fr/cartes/a%20b")?.params, { slug: "a b" });
  });

  it("conserve la query", () => {
    assert.equal(alternatePath("/fr/boutiques/x", "?view=map", "en"), "/en/shops/x?view=map");
    assert.equal(localizedPath("home", "en", {}, new URLSearchParams({ ref: "a" })), "/en?ref=a");
    assert.equal(alternatePath("/fr/tournois/publics", "?country=FR", "en"), "/en/tournois/publics?country=FR");
  });

  it("ignore la barre finale", () => {
    assert.equal(publicRouteOfPath("/fr/cartes/v/")?.key, "card");
  });

  it("localise aussi les écrans de l'application, sans en faire des pages publiques", () => {
    assert.equal(alternatePath("/fr/decks", null, "de"), "/de/decks");
    assert.equal(alternatePath("/de/decks", null, "fr"), "/fr/decks");
    assert.equal(alternatePath("/fr/tournois/abc", null, "it"), "/it/tournois/abc");
    for (const path of ["/fr/cards", "/fr/decks", "/fr/tournois", "/fr/tournois/abc", "/fr/classeur/x", "/fr/tournois/publics", "/fr/boutiques", "/fr/comment-jouer"]) {
      assert.equal(publicRouteOfPath(path), null, path);
    }
  });

  it("explorateur : /fr/cards en français, /<langue>/explorer ailleurs ; /en/cards reste la liste publique", () => {
    assert.equal(alternatePath("/fr/cards", null, "en"), "/en/explorer");
    assert.equal(alternatePath("/en/explorer", "?q=v", "fr"), "/fr/cards?q=v");
    assert.equal(publicRouteOfPath("/en/cards")?.key, "cards");
    assert.equal(matchRoute("/fr/cards")?.route, "/cards");
    // Ancienne adresse française sans préfixe : reconnue (le proxy la renvoie vers « /fr/cards »).
    assert.equal(matchRoute("/cards")?.locale, "fr");
  });

  it("URL inconnue : aucune correspondance", () => {
    assert.equal(alternatePath("/nl/cards", null, "fr"), null);
    assert.equal(alternatePath("/de/cards/v", null, "fr"), null);
  });

  it("ancres des annuaires sur l'accueil", () => {
    assert.equal(landingSectionPath("tournaments", "fr"), "/fr#tournois");
    assert.equal(landingSectionPath("shops", "en"), "/en#shops");
    assert.equal(landingSectionPath("tournaments", "it"), "/it#tornei");
  });

  it("déclare les cinq langues et x-default", () => {
    assert.deepEqual(languageAlternates("card", { slug: "v-streetkid" }), {
      fr: "/fr/cartes/v-streetkid",
      en: "/en/cards/v-streetkid",
      de: "/de/karten/v-streetkid",
      es: "/es/cartas/v-streetkid",
      it: "/it/carte/v-streetkid",
      "x-default": "/en/cards/v-streetkid",
    });
  });

  it("le formateur du proxy donne les mêmes URL que next-intl", () => {
    for (const route of Object.keys(pathnames) as AppPathname[]) {
      const params = Object.fromEntries([...route.matchAll(/\[(\w+)\]/g)].map(([, name]) => [name, "x y"]));
      for (const locale of LOCALES) assert.equal(formatRoute(route, locale, params), routePath(route, locale, params), `${route} ${locale}`);
    }
  });
});
