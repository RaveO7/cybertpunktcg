/**
 * Mesure de performance (scripts/perf-audit.ts) : médiane des visites et écarts affichés entre deux mesures
 * (mieux / moins bien, rien sous le bruit de mesure).
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { medianScores, samePage, type LighthouseScores } from "../../scripts/perf/lighthouse";
import { median, renderTables } from "../../scripts/perf/report";

function run(lcp: number, performance: number) {
  return {
    date: "2026-11-12",
    label: "essai",
    pages: { accueil: { profiles: { mobile: { timings: { lcp }, lighthouse: { performance } } } } },
  };
}

function accueilRow(tables: string) {
  const row = tables.split("\n").find((line) => line.startsWith("| accueil |"));
  assert.ok(row, "ligne accueil absente");
  return row;
}

describe("median", () => {
  it("prend la valeur du milieu, ou la moyenne arrondie des deux du milieu", () => {
    assert.equal(median([900, 300, 500]), 500);
    assert.equal(median([400, 100, 300, 200]), 250);
  });
});

describe("medianScores", () => {
  const scores = (performance: number, cls: number, tbt: number): LighthouseScores => ({
    performance,
    accessibility: 95,
    bestPractices: 100,
    seo: 66,
    fcp: 1200,
    lcp: 3000,
    tbt,
    cls,
    speedIndex: 1800,
  });

  it("médiane de chaque métrique, indépendamment des autres", () => {
    const result = medianScores([scores(60, 0.02, 800), scores(92, 0, 70), scores(80, 0.98, 200)]);
    assert.equal(result.performance, 80);
    assert.equal(result.cls, 0.02);
    assert.equal(result.tbt, 200);
  });

  it("deux passages : moyenne des deux, CLS au millième (pas arrondi à l'entier)", () => {
    const result = medianScores([scores(90, 0.065, 30), scores(97, 0.056, 70)]);
    assert.equal(result.performance, 94);
    assert.equal(result.cls, 0.061);
  });
});

describe("samePage", () => {
  it("écarte un passage redirigé vers une autre page ou un autre site", () => {
    assert.ok(samePage("https://site.app/fr/cgu/?x=1", "https://site.app/fr/cgu"));
    assert.ok(!samePage("https://vercel.com/login?next=%2Ffr%2Fcgu", "https://site.app/fr/cgu"));
    assert.ok(!samePage("https://site.app/fr/connexion", "https://site.app/fr/cgu"));
  });
});

describe("renderTables", () => {
  it("marque une baisse de temps et une hausse de score comme des progrès", () => {
    const row = accueilRow(renderTables(run(800, 90), run(1200, 80)));
    assert.match(row, /0\.80 ▼0\.40 ✓/);
    assert.match(row, /90 ▲10 ✓/);
  });

  it("marque une hausse de temps et une baisse de score comme des reculs", () => {
    const row = accueilRow(renderTables(run(1500, 70), run(1200, 80)));
    assert.match(row, /1\.50 ▲0\.30 ✗/);
    assert.match(row, /70 ▼10 ✗/);
  });

  it("n'affiche pas d'écart sous le bruit de mesure", () => {
    const row = accueilRow(renderTables(run(1250, 81), run(1200, 80)));
    assert.doesNotMatch(row, /[▲▼]/);
  });
});
