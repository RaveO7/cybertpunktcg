import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { resolveLocale } from "../../src/components/LocaleProvider";

describe("seo : langue imposée par l'URL", () => {
  it("URL française + préférence anglaise : français", () => {
    assert.deepEqual(resolveLocale("/cartes", "en", false), { locale: "fr", routeLocale: "fr" });
  });

  it("URL anglaise + préférence française : anglais", () => {
    assert.deepEqual(resolveLocale("/en/shops/arasaka", "fr", false), { locale: "en", routeLocale: "en" });
  });

  it("page de l'application + préférence italienne : italien", () => {
    assert.deepEqual(resolveLocale("/decks", "it", false), { locale: "it", routeLocale: null });
  });

  it("page légale : langue enregistrée", () => {
    assert.deepEqual(resolveLocale("/cgu", "de", false), { locale: "de", routeLocale: null });
  });

  it("tableau de bord sur / : langue enregistrée", () => {
    assert.deepEqual(resolveLocale("/", "es", true), { locale: "es", routeLocale: null });
  });
});
