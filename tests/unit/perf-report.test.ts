/**
 * Mesure de performance (scripts/perf-audit.ts) : médiane des visites et écarts affichés entre deux mesures
 * (mieux / moins bien, rien sous le bruit de mesure).
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
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
