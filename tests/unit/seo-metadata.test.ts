import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { fitTitle, pageMetadata, privateMetadata, truncateDescription } from "../../src/lib/seo/metadata";

describe("seo : métadonnées", () => {
  it("laisse intacte une description courte", () => {
    assert.equal(truncateDescription("  Tournois   à Lyon. "), "Tournois à Lyon.");
  });

  it("tronque à 160 caractères sur une limite de mot", () => {
    const long = "Boutique de jeux ".repeat(30);
    const result = truncateDescription(long);
    assert.ok(result.length <= 160, String(result.length));
    assert.ok(result.endsWith("…"));
    assert.ok(!/\s…$/.test(result));
    assert.ok(long.startsWith(result.slice(0, -1)));
  });

  it("canonique sans query et versions linguistiques d'une page bilingue", () => {
    const meta = pageMetadata({ locale: "en", page: { key: "tournaments" }, title: "Tournaments", description: "Find one." });
    assert.equal(meta.alternates?.canonical, "/en/tournaments");
    assert.deepEqual(meta.alternates?.languages, { fr: "/tournois/publics", en: "/en/tournaments", "x-default": "/tournois/publics" });
    assert.equal((meta.openGraph as { url?: string }).url, "/en/tournaments");
    assert.equal(meta.title, "Tournaments");
  });

  it("pas d'alternative pour une page uniquement française", () => {
    const meta = pageMetadata({ locale: "fr", page: { path: "/cgu" }, title: "CGU", description: "Conditions." });
    assert.equal(meta.alternates?.canonical, "/cgu");
    assert.equal(meta.alternates?.languages, undefined);
  });

  it("titre absolu pour l'accueil et noindex sur demande", () => {
    const meta = pageMetadata({ locale: "fr", page: { key: "home" }, title: "TCG Tracker", absoluteTitle: true, description: "x", noindex: true });
    assert.deepEqual(meta.title, { absolute: "TCG Tracker" });
    assert.deepEqual(meta.robots, { index: false, follow: true });
  });

  it("titres de 70 caractères au plus, marque ajoutée seulement si elle tient", () => {
    assert.deepEqual(fitTitle("Cartes"), { title: "Cartes", withBrand: true });
    const long = fitTitle("Arasaka Games & Co, boutique Cyberpunk TCG à Saint-Étienne");
    assert.equal(long.withBrand, false);
    assert.ok(long.title.length <= 70);
    const veryLong = fitTitle("Un nom de tournoi extrêmement long qui dépasse largement la limite des moteurs de recherche");
    assert.ok(veryLong.title.length <= 70 && veryLong.title.endsWith("…"));
    const meta = pageMetadata({ locale: "fr", page: { key: "cards" }, title: long.title, description: "x" });
    assert.deepEqual(meta.title, { absolute: long.title });
  });

  it("pages privées en noindex, nofollow", () => {
    assert.deepEqual(privateMetadata.robots, { index: false, follow: false });
  });
});
