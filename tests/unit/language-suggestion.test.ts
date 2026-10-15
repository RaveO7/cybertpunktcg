import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "vitest";
import { languageSuggestion } from "../../src/lib/i18n/geo-locale";
import { isLocaleSwitching, markLocaleSwitching, migrateLegacyLocalePreference, readLocalePreference } from "../../src/i18n/preference";

const never = () => false;

describe("i18n : suggestion de la langue du visiteur", () => {
  it("préférence enregistrée : prioritaire sur le pays et le navigateur", () => {
    assert.equal(languageSuggestion({ current: "fr", preference: "it", country: "ES", languages: ["de"], dismissed: never }), "it");
  });

  it("sans préférence : langue du pays de connexion", () => {
    assert.equal(languageSuggestion({ current: "fr", preference: null, country: "ES", languages: ["fr-FR"], dismissed: never }), "es");
  });

  it("pays inconnu ou multilingue : première langue du navigateur proposée par le site", () => {
    assert.equal(languageSuggestion({ current: "fr", preference: null, country: null, languages: ["nl", "de-AT"], dismissed: never }), "de");
    assert.equal(languageSuggestion({ current: "en", preference: null, country: "CH", languages: ["it-CH"], dismissed: never }), "it");
  });

  it("aucune langue reconnue : anglais", () => {
    assert.equal(languageSuggestion({ current: "fr", preference: null, country: "JP", languages: ["ja"], dismissed: never }), "en");
    assert.equal(languageSuggestion({ current: "fr", preference: null, country: null, languages: [], dismissed: never }), "en");
  });

  it("page déjà dans la langue du visiteur : pas de suggestion", () => {
    assert.equal(languageSuggestion({ current: "es", preference: null, country: "ES", languages: [], dismissed: never }), null);
  });

  it("suggestion refusée pour cette langue : plus proposée", () => {
    assert.equal(languageSuggestion({ current: "fr", preference: null, country: "DE", languages: [], dismissed: (l) => l === "de" }), null);
  });
});

describe("i18n : préférence de langue (cookie)", () => {
  let cookie = "";
  let storage: Record<string, string> = {};
  const globals = globalThis as unknown as Record<string, unknown>;

  beforeEach(() => {
    cookie = "";
    storage = {};
    globals.document = {
      get cookie() {
        return cookie;
      },
      set cookie(value: string) {
        const [pair] = value.split(";");
        const [name] = pair.split("=");
        const others = cookie.split("; ").filter((part) => part && !part.startsWith(`${name}=`));
        cookie = [...others, pair].join("; ");
      },
    };
    globals.window = {
      location: { protocol: "https:" },
      localStorage: { getItem: (key: string) => storage[key] ?? null },
    };
  });

  afterEach(() => {
    delete globals.document;
    delete globals.window;
  });

  it("reprend une fois l'ancienne préférence du localStorage dans le cookie", () => {
    storage["cptcg-locale"] = "it";
    assert.equal(readLocalePreference(), null);
    assert.equal(migrateLegacyLocalePreference(), "it");
    assert.equal(readLocalePreference(), "it");
    storage["cptcg-locale"] = "de";
    assert.equal(migrateLegacyLocalePreference(), null, "cookie déjà présent : ancienne valeur ignorée");
    assert.equal(readLocalePreference(), "it");
  });

  it("ignore une ancienne valeur invalide", () => {
    storage["cptcg-locale"] = "nl";
    assert.equal(migrateLegacyLocalePreference(), null);
    assert.equal(readLocalePreference(), null);
  });

  it("changement de langue en cours : signalé aux composants (bandeau masqué)", () => {
    assert.equal(isLocaleSwitching(), false);
    markLocaleSwitching();
    assert.equal(isLocaleSwitching(), true);
  });
});
