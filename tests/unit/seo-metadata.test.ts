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

  it("canonique sans query et versions linguistiques d'une page publique", async () => {
    const meta = await pageMetadata({ locale: "en", page: { key: "shop", params: { slug: "night" } }, title: "Night", description: "A store." });
    assert.equal(meta.alternates?.canonical, "/en/shops/night");
    assert.deepEqual(meta.alternates?.languages, {
      fr: "/boutiques/night",
      en: "/en/shops/night",
      de: "/de/shops/night",
      es: "/es/tiendas/night",
      it: "/it/negozi/night",
      "x-default": "/boutiques/night",
    });
    assert.deepEqual((meta.openGraph as { alternateLocale?: string[] }).alternateLocale, ["fr_FR", "de_DE", "es_ES", "it_IT"]);
    assert.equal((meta.openGraph as { url?: string }).url, "/en/shops/night");
    assert.equal(meta.title, "Night");
  });

  it("page sans versions linguistiques déclarées : pas d'alternative", async () => {
    const meta = await pageMetadata({ locale: "fr", page: { path: "/classeur/x" }, title: "Classeur", description: "Cartes." });
    assert.equal(meta.alternates?.canonical, "/classeur/x");
    assert.equal(meta.alternates?.languages, undefined);
  });

  it("titre absolu pour l'accueil et noindex sur demande", async () => {
    const meta = await pageMetadata({ locale: "fr", page: { key: "home" }, title: "TCG Tracker", absoluteTitle: true, description: "x", noindex: true });
    assert.deepEqual(meta.title, { absolute: "TCG Tracker" });
    assert.deepEqual(meta.robots, { index: false, follow: true });
  });

  it("titres de 70 caractères au plus, marque ajoutée seulement si elle tient", async () => {
    assert.deepEqual(fitTitle("Cartes"), { title: "Cartes", withBrand: true });
    const long = fitTitle("Arasaka Games & Co, boutique Cyberpunk TCG à Saint-Étienne");
    assert.equal(long.withBrand, false);
    assert.ok(long.title.length <= 70);
    const veryLong = fitTitle("Un nom de tournoi extrêmement long qui dépasse largement la limite des moteurs de recherche");
    assert.ok(veryLong.title.length <= 70 && veryLong.title.endsWith("…"));
    const meta = await pageMetadata({ locale: "fr", page: { key: "home" }, title: long.title, description: "x" });
    assert.deepEqual(meta.title, { absolute: long.title });
  });

  it("titre de l'accueil et image de partage par défaut dans la langue de la page", async () => {
    const meta = await pageMetadata({ locale: "it", page: { key: "home" }, title: "x", description: "x" });
    const image = (meta.openGraph as { images: { url: string; alt: string }[] }).images[0];
    assert.equal(image.url, "/og/it");
    assert.match(image.alt, /Carte, collezione e tornei di Cyberpunk TCG/);
  });

  it("pages privées en noindex, nofollow", () => {
    assert.deepEqual(privateMetadata.robots, { index: false, follow: false });
  });
});
