import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { isCountryCode, suggestedSiteLocale } from "../../src/lib/i18n/geo-locale";

describe("i18n : langue proposée selon le pays", () => {
  it("connexion depuis la France : français, même avec un navigateur anglais", () => {
    assert.equal(suggestedSiteLocale({ stored: null, country: "FR", languages: ["en-US"] }), "fr");
  });

  it("connexion depuis l'outre-mer ou l'Afrique francophone : français", () => {
    assert.equal(suggestedSiteLocale({ stored: null, country: "RE", languages: [] }), "fr");
    assert.equal(suggestedSiteLocale({ stored: null, country: "SN", languages: [] }), "fr");
  });

  it("connexion depuis les États-Unis ou l'Allemagne : anglais, même avec un navigateur français", () => {
    assert.equal(suggestedSiteLocale({ stored: null, country: "US", languages: ["fr-FR"] }), "en");
    assert.equal(suggestedSiteLocale({ stored: null, country: "DE", languages: ["de-DE"] }), "en");
  });

  it("pays bilingue : la langue du navigateur décide", () => {
    assert.equal(suggestedSiteLocale({ stored: null, country: "BE", languages: ["fr-BE", "nl"] }), "fr");
    assert.equal(suggestedSiteLocale({ stored: null, country: "CA", languages: ["en-CA"] }), "en");
  });

  it("pays inconnu (développement local) : la langue du navigateur décide", () => {
    assert.equal(suggestedSiteLocale({ stored: null, country: null, languages: ["fr"] }), "fr");
    assert.equal(suggestedSiteLocale({ stored: null, country: "xx", languages: ["es"] }), "en");
  });

  it("langue choisie dans l'app : prioritaire sur le pays", () => {
    assert.equal(suggestedSiteLocale({ stored: "en", country: "FR", languages: ["fr"] }), "en");
    assert.equal(suggestedSiteLocale({ stored: "fr", country: "US", languages: ["en"] }), "fr");
    assert.equal(suggestedSiteLocale({ stored: "de", country: "FR", languages: ["fr"] }), "en");
  });

  it("code pays : deux lettres majuscules", () => {
    assert.equal(isCountryCode("FR"), true);
    assert.equal(isCountryCode("fr"), false);
    assert.equal(isCountryCode("FRA"), false);
    assert.equal(isCountryCode(undefined), false);
  });
});
