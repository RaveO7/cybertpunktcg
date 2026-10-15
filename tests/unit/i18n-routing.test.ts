import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { LOCALES, type Locale } from "../../src/i18n/config";
import { getPathname } from "../../src/i18n/navigation";
import { pathnames, type AppPathname } from "../../src/i18n/routing";

type Expected = { pathname: AppPathname; params?: Record<string, string>; urls: Record<Locale, string> };

// Tableau de la spec seo/localization (pages publiques) et du design §4 (pages légales).
const PUBLIC_URLS: Expected[] = [
  { pathname: "/", urls: { fr: "/", en: "/en", de: "/de", es: "/es", it: "/it" } },
  { pathname: "/cartes", urls: { fr: "/cartes", en: "/en/cards", de: "/de/karten", es: "/es/cartas", it: "/it/carte" } },
  {
    pathname: "/cartes/[slug]",
    params: { slug: "v-streetkid" },
    urls: {
      fr: "/cartes/v-streetkid",
      en: "/en/cards/v-streetkid",
      de: "/de/karten/v-streetkid",
      es: "/es/cartas/v-streetkid",
      it: "/it/carte/v-streetkid",
    },
  },
  {
    pathname: "/tournois/publics/[id]",
    params: { id: "abc" },
    urls: {
      fr: "/tournois/publics/abc",
      en: "/en/tournaments/abc",
      de: "/de/turniere/abc",
      es: "/es/torneos/abc",
      it: "/it/tornei/abc",
    },
  },
  {
    pathname: "/boutiques/[slug]",
    params: { slug: "arasaka-games" },
    urls: {
      fr: "/boutiques/arasaka-games",
      en: "/en/shops/arasaka-games",
      de: "/de/shops/arasaka-games",
      es: "/es/tiendas/arasaka-games",
      it: "/it/negozi/arasaka-games",
    },
  },
  {
    pathname: "/mentions-legales",
    urls: { fr: "/mentions-legales", en: "/en/legal-notice", de: "/de/impressum", es: "/es/aviso-legal", it: "/it/note-legali" },
  },
  {
    pathname: "/cgu",
    urls: { fr: "/cgu", en: "/en/terms", de: "/de/nutzungsbedingungen", es: "/es/condiciones", it: "/it/termini" },
  },
  {
    pathname: "/confidentialite",
    urls: { fr: "/confidentialite", en: "/en/privacy", de: "/de/datenschutz", es: "/es/privacidad", it: "/it/privacy" },
  },
];

function urlOf(entry: Expected, locale: Locale) {
  const href = entry.params ? { pathname: entry.pathname, params: entry.params } : entry.pathname;
  // @ts-expect-error -- union de routes : chaque entrée du tableau fournit les paramètres de sa route.
  return getPathname({ href, locale });
}

describe("i18n : URL de chaque page dans chaque langue", () => {
  for (const entry of PUBLIC_URLS) {
    it(`${entry.pathname}`, () => {
      for (const locale of LOCALES) assert.equal(urlOf(entry, locale), entry.urls[locale], `${entry.pathname} en ${locale}`);
    });
  }

  it("explorateur de l'application : /cards en français, /explorer ailleurs (libère /en/cards)", () => {
    assert.equal(getPathname({ href: "/cards", locale: "fr" }), "/cards");
    assert.equal(getPathname({ href: "/cards", locale: "en" }), "/en/explorer");
    assert.equal(getPathname({ href: "/cards", locale: "de" }), "/de/explorer");
  });

  it("écrans de l'application : même chemin, préfixé hors français", () => {
    assert.equal(getPathname({ href: "/decks", locale: "fr" }), "/decks");
    assert.equal(getPathname({ href: "/decks", locale: "de" }), "/de/decks");
    assert.equal(getPathname({ href: "/parametres", locale: "es" }), "/es/parametres");
  });

  it("chaque route déclare une URL pour chaque langue (ou la même pour toutes)", () => {
    for (const [pathname, config] of Object.entries(pathnames)) {
      if (typeof config === "string") continue;
      for (const locale of LOCALES) assert.ok((config as Record<string, string>)[locale], `${pathname} : ${locale}`);
    }
  });
});
