/**
 * Coût d'Intl au démarrage des pages : préchauffage après le premier affichage et noms de pays
 * (un seul Intl.DisplayNames par langue).
 */
import assert from "node:assert/strict";
import { afterEach, describe, it, vi } from "vitest";
import { countryName, countryOptions } from "../../src/components/geo/countries";
import { intlWarmupScript } from "../../src/lib/intl-warmup";

describe("noms de pays", () => {
  afterEach(() => vi.restoreAllMocks());

  it("nom dans la langue de l'app, code rendu tel quel s'il est invalide", () => {
    assert.equal(countryName("DE", "fr"), "Allemagne");
    assert.equal(countryName("DE", "en"), "Germany");
    assert.equal(countryName("??", "fr"), "??");
  });

  it("une seule instance Intl.DisplayNames par langue pour toute une liste", () => {
    const spy = vi.spyOn(Intl, "DisplayNames");
    countryOptions("es");
    countryOptions("es");
    assert.equal(spy.mock.calls.length, 1);
  });
});

describe("préchauffage d'Intl", () => {
  it("rien avant le premier affichage, puis une tâche par famille de formats", () => {
    const frames: (() => void)[] = [];
    const timers: (() => void)[] = [];
    const created: string[] = [];
    const fakeIntl = {
      NumberFormat: class { constructor(locale: string) { created.push(`number:${locale}`); } format() { return ""; } },
      PluralRules: class { constructor(locale: string) { created.push(`plural:${locale}`); } select() { return "other"; } },
      DateTimeFormat: class { constructor(locale: string) { created.push(`date:${locale}`); } format() { return ""; } },
    };
    const run = new Function("Intl", "requestAnimationFrame", "setTimeout", intlWarmupScript("de-DE"));
    run(fakeIntl, (callback: () => void) => frames.push(callback), (callback: () => void) => timers.push(callback));

    assert.deepEqual(created, []);
    assert.equal(timers.length, 0);
    frames.forEach((frame) => frame());
    assert.equal(timers.length, 2);
    assert.deepEqual(created, []);
    timers.forEach((timer) => timer());
    assert.deepEqual(created, ["number:de-DE", "plural:de-DE", "date:de-DE"]);
  });
});
