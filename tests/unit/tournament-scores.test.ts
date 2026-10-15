import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  matchPoints,
  resultError,
  sameResult,
  walkoverGames,
  winnerOf,
  type MatchResult,
} from "../../src/lib/tournament/scores";

const normal = (gamesA: number, gamesB: number): MatchResult => ({ kind: "normal", gamesA, gamesB });

describe("scores autorisés", () => {
  it("accepte les scores Bo3 possibles", () => {
    for (const [a, b] of [[2, 0], [2, 1], [1, 0], [1, 1], [0, 0], [0, 2], [1, 2], [0, 1]]) {
      assert.equal(resultError(normal(a, b), "bo3", "swiss"), null, `${a}-${b}`);
    }
  });

  it("refuse 3-0, 2-2 et les valeurs négatives ou non entières en Bo3", () => {
    assert.equal(resultError(normal(3, 0), "bo3", "swiss"), "tournaments.invalidScore");
    assert.equal(resultError(normal(2, 2), "bo3", "swiss"), "tournaments.invalidScore");
    assert.equal(resultError(normal(-1, 0), "bo3", "swiss"), "tournaments.invalidScore");
    assert.equal(resultError(normal(1.5, 0), "bo3", "swiss"), "tournaments.invalidScore");
  });

  it("n'accepte que 1-0, 0-1 et 0-0 en Bo1", () => {
    assert.equal(resultError(normal(1, 0), "bo1", "swiss"), null);
    assert.equal(resultError(normal(0, 1), "bo1", "swiss"), null);
    assert.equal(resultError(normal(0, 0), "bo1", "swiss"), null);
    assert.equal(resultError(normal(2, 0), "bo1", "swiss"), "tournaments.invalidScore");
    assert.equal(resultError(normal(1, 1), "bo1", "swiss"), "tournaments.invalidScore");
  });

  it("1-1 au temps est un nul qui rapporte 1 point à chacun", () => {
    assert.equal(winnerOf(normal(1, 1)), "draw");
    assert.deepEqual(matchPoints(normal(1, 1)), { a: 1, b: 1 });
  });

  it("le gagnant est celui qui a le plus de manches", () => {
    assert.equal(winnerOf(normal(2, 1)), "A");
    assert.equal(winnerOf(normal(0, 1)), "B");
    assert.deepEqual(matchPoints(normal(1, 0)), { a: 3, b: 0 });
  });
});

describe("résultats spéciaux", () => {
  it("double défaite : aucun point", () => {
    const result: MatchResult = { kind: "double_loss", gamesA: 0, gamesB: 0 };
    assert.equal(resultError(result, "bo3", "swiss"), null);
    assert.equal(winnerOf(result), "none");
    assert.deepEqual(matchPoints(result), { a: 0, b: 0 });
  });

  it("ID : nul 0-0, 1 point chacun", () => {
    const result: MatchResult = { kind: "id", gamesA: 0, gamesB: 0 };
    assert.equal(resultError(result, "bo3", "swiss"), null);
    assert.deepEqual(matchPoints(result), { a: 1, b: 1 });
    assert.equal(resultError({ kind: "id", gamesA: 1, gamesB: 0 }, "bo3", "swiss"), "tournaments.invalidScore");
  });

  it("interdits en top cut", () => {
    assert.equal(resultError({ kind: "id", gamesA: 0, gamesB: 0 }, "bo3", "top_cut"), "tournaments.winnerRequired");
    assert.equal(resultError({ kind: "double_loss", gamesA: 0, gamesB: 0 }, "bo3", "top_cut"), "tournaments.winnerRequired");
  });
});

describe("pas de nul en top cut", () => {
  it("refuse 1-1 et 0-0 en demi-finale", () => {
    assert.equal(resultError(normal(1, 1), "bo3", "top_cut"), "tournaments.winnerRequired");
    assert.equal(resultError(normal(0, 0), "bo1", "top_cut"), "tournaments.winnerRequired");
    assert.equal(resultError(normal(2, 1), "bo3", "top_cut"), null);
  });
});

describe("utilitaires", () => {
  it("victoire sans jeu : 2-0 en Bo3, 1-0 en Bo1", () => {
    assert.equal(walkoverGames("bo3"), 2);
    assert.equal(walkoverGames("bo1"), 1);
  });

  it("compare deux résultats", () => {
    assert.equal(sameResult(normal(2, 1), normal(2, 1)), true);
    assert.equal(sameResult(normal(2, 1), normal(1, 2)), false);
    assert.equal(sameResult(normal(0, 0), { kind: "id", gamesA: 0, gamesB: 0 }), false);
  });
});
