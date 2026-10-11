import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { seededRng } from "../../src/lib/tournament/random";
import type { Standing } from "../../src/lib/tournament/standings";
import {
  bracketSeedOrder,
  cutEligible,
  cutSize,
  firstCutRound,
  nextCutRound,
  nextSlot,
  selectCut,
} from "../../src/lib/tournament/top-cut";

const NOW = new Date("2026-10-10T22:00:00Z");

function row(id: string, points: number, omw = 0.5, status: Standing["status"] = "active"): Standing {
  return {
    playerId: id,
    name: id,
    status,
    rank: 0,
    points,
    wins: 0,
    losses: 0,
    draws: 0,
    matchesPlayed: 0,
    matchWinPct: 0.5,
    gameWinPct: 0.5,
    omwPct: omw,
    gwPct: 0.5,
    ogwPct: 0.5,
    opponentIds: [],
    hadBye: false,
  };
}

describe("taille du top cut", () => {
  it("auto selon l'effectif", () => {
    assert.equal(cutSize("auto", 8), 0);
    assert.equal(cutSize("auto", 9), 4);
    assert.equal(cutSize("auto", 16), 4);
    assert.equal(cutSize("auto", 20), 8);
    assert.equal(cutSize("auto", 64), 8);
    assert.equal(cutSize("auto", 65), 16);
  });

  it("aucun et taille fixe", () => {
    assert.equal(cutSize("aucun", 100), 0);
    assert.equal(cutSize("8", 30), 8);
  });

  it("taille ≥ joueurs restants : puissance de 2 strictement inférieure", () => {
    assert.equal(cutSize("8", 8), 4);
    assert.equal(cutSize("8", 6), 4);
    assert.equal(cutSize("4", 3), 2);
    assert.equal(cutSize("2", 2), 0);
  });
});

describe("qualification", () => {
  it("les N premiers, sans les droppés, DQ ni ceux qui déclinent", () => {
    const standings = [row("A", 12), row("B", 9, 0.5, "dropped"), row("C", 9), row("D", 6, 0.5, "dq"), row("E", 6), row("F", 3)];
    const eligible = cutEligible(standings, new Set(["C"]));
    assert.deepEqual(selectCut(eligible, 2, seededRng(1), NOW), { qualified: ["A", "E"], draw: null });
  });

  it("égalité parfaite au seuil : tirage au sort enregistré", () => {
    const standings = [row("A", 9), row("B", 6), row("C", 6), row("D", 6), row("E", 0)];
    const { qualified, draw } = selectCut(standings, 2, seededRng(4), NOW);
    assert.equal(qualified[0], "A");
    assert.ok(draw);
    assert.deepEqual(draw.tied, ["B", "C", "D"]);
    assert.equal(draw.picked.length, 1);
    assert.equal(qualified[1], draw.picked[0]);
    assert.equal(draw.at, NOW.toISOString());
  });

  it("égalité sur les points mais pas sur l'OMW : pas de tirage", () => {
    const standings = [row("A", 6, 0.7), row("B", 6, 0.6), row("C", 6, 0.5)];
    assert.deepEqual(selectCut(standings, 2, seededRng(1), NOW), { qualified: ["A", "B"], draw: null });
  });

  it("qualifié qui décline : le suivant prend sa place", () => {
    const standings = [row("A", 12), row("B", 9), row("C", 6), row("D", 3)];
    assert.deepEqual(selectCut(cutEligible(standings, new Set(["B"])), 2, seededRng(1), NOW).qualified, ["A", "C"]);
  });
});

describe("arbre", () => {
  it("ordre des têtes de série", () => {
    assert.deepEqual(bracketSeedOrder(2), [1, 2]);
    assert.deepEqual(bracketSeedOrder(4), [1, 4, 2, 3]);
    assert.deepEqual(bracketSeedOrder(8), [1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("top 8 : quarts 1–8, 4–5, 2–7, 3–6 ; 1 et 2 ne se croisent qu'en finale", () => {
    const seeds = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"];
    assert.deepEqual(firstCutRound(seeds), [
      { slot: 0, a: "S1", b: "S8" },
      { slot: 1, a: "S4", b: "S5" },
      { slot: 2, a: "S2", b: "S7" },
      { slot: 3, a: "S3", b: "S6" },
    ]);
    const semis = nextCutRound(new Map([[0, "S1"], [1, "S5"], [2, "S2"], [3, "S3"]]));
    assert.deepEqual(semis, [{ slot: 0, a: "S1", b: "S5" }, { slot: 1, a: "S2", b: "S3" }]);
    assert.deepEqual(nextCutRound(new Map([[0, "S1"], [1, "S2"]])), [{ slot: 0, a: "S1", b: "S2" }]);
    assert.deepEqual(nextCutRound(new Map([[0, "S1"]])), [], "finale jouée : pas de tour suivant");
  });

  it("propagation d'une correction vers le tour suivant", () => {
    assert.deepEqual(nextSlot(0), { slot: 0, side: "A" });
    assert.deepEqual(nextSlot(3), { slot: 1, side: "B" });
  });
});
