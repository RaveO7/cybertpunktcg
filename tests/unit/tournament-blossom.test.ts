import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { maxWeightMatching, type WeightedEdge } from "../../src/lib/tournament/blossom";
import { randomInt, seededRng, type Rng } from "../../src/lib/tournament/random";

/** Meilleur couplage par énumération : cardinalité maximale (si demandé) puis poids maximal. */
function bruteForce(n: number, edges: WeightedEdge[], maxCardinality: boolean) {
  const weight = new Map<string, number>();
  for (const [i, j, w] of edges) {
    const key = i < j ? `${i}-${j}` : `${j}-${i}`;
    weight.set(key, Math.max(weight.get(key) ?? -Infinity, w));
  }
  let best = { size: -1, total: -Infinity };
  const used = new Array(n).fill(false);
  const visit = (start: number, size: number, total: number) => {
    let v = start;
    while (v < n && used[v]) v += 1;
    if (v >= n) {
      const better = maxCardinality
        ? size > best.size || (size === best.size && total > best.total)
        : total > best.total;
      if (better) best = { size, total };
      return;
    }
    used[v] = true;
    visit(v + 1, size, total); // v reste seul
    for (let w = v + 1; w < n; w += 1) {
      const key = `${v}-${w}`;
      if (used[w] || !weight.has(key)) continue;
      used[w] = true;
      visit(v + 1, size + 1, total + weight.get(key)!);
      used[w] = false;
    }
    used[v] = false;
  };
  visit(0, 0, 0);
  return best;
}

function evaluate(mate: number[], edges: WeightedEdge[]) {
  const weight = new Map<string, number>();
  for (const [i, j, w] of edges) {
    const key = i < j ? `${i}-${j}` : `${j}-${i}`;
    weight.set(key, Math.max(weight.get(key) ?? -Infinity, w));
  }
  let size = 0;
  let total = 0;
  mate.forEach((w, v) => {
    if (w === -1) return;
    assert.equal(mate[w], v, "couplage non symétrique");
    if (v < w) {
      const key = `${v}-${w}`;
      assert.ok(weight.has(key), `arête ${key} inexistante`);
      size += 1;
      total += weight.get(key)!;
    }
  });
  return { size, total };
}

function randomGraph(rng: Rng, n: number, density: number, maxWeight: number): WeightedEdge[] {
  const edges: WeightedEdge[] = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (rng() < density) edges.push([i, j, randomInt(rng, maxWeight + 1)]);
    }
  }
  return edges;
}

describe("couplage de poids maximal", () => {
  it("cas simples", () => {
    assert.deepEqual(maxWeightMatching([]), []);
    assert.deepEqual(maxWeightMatching([[0, 1, 1]]), [1, 0]);
    // Chemin 0-1-2-3 : 1-2 (poids 11) seul vaut plus que 0-1 + 2-3 (5 + 5)…
    assert.deepEqual(maxWeightMatching([[0, 1, 5], [1, 2, 11], [2, 3, 5]]), [-1, 2, 1, -1]);
    // … sauf si l'on exige la cardinalité maximale.
    assert.deepEqual(maxWeightMatching([[0, 1, 5], [1, 2, 11], [2, 3, 5]], true), [1, 0, 3, 2]);
  });

  it("fleur (cycle impair) puis augmentation à travers elle", () => {
    // Triangle 0-1-2 relié à 3 et 4 : nécessite la contraction d'une fleur.
    const edges: WeightedEdge[] = [[0, 1, 8], [0, 2, 9], [1, 2, 10], [1, 3, 7], [2, 4, 7], [3, 4, 1]];
    assert.deepEqual(evaluate(maxWeightMatching(edges, true), edges), bruteForce(5, edges, true));
  });

  it("refuse les poids non entiers", () => {
    assert.throws(() => maxWeightMatching([[0, 1, 1.5]]), /Poids entier requis/);
  });

  it("égale la force brute sur des graphes complets aléatoires (n ≤ 10)", () => {
    const rng = seededRng(2026);
    for (let run = 0; run < 400; run += 1) {
      const n = 2 + randomInt(rng, 9);
      const edges = randomGraph(rng, n, 1, 1 + randomInt(rng, 1000));
      for (const maxCardinality of [true, false]) {
        const expected = bruteForce(n, edges, maxCardinality);
        const actual = evaluate(maxWeightMatching(edges, maxCardinality), edges);
        if (maxCardinality) assert.equal(actual.size, expected.size, `run ${run} n=${n}`);
        assert.equal(actual.total, expected.total, `run ${run} n=${n} maxCard=${maxCardinality}`);
      }
    }
  });

  it("égale la force brute sur des graphes clairsemés aléatoires (n ≤ 10)", () => {
    const rng = seededRng(77);
    for (let run = 0; run < 600; run += 1) {
      const n = 2 + randomInt(rng, 9);
      const edges = randomGraph(rng, n, 0.2 + rng() * 0.6, 1 + randomInt(rng, 20));
      if (edges.length === 0) continue;
      for (const maxCardinality of [true, false]) {
        const expected = bruteForce(n, edges, maxCardinality);
        const actual = evaluate(maxWeightMatching(edges, maxCardinality), edges);
        if (maxCardinality) assert.equal(actual.size, expected.size, `run ${run} n=${n}`);
        assert.equal(actual.total, expected.total, `run ${run} n=${n} maxCard=${maxCardinality}`);
      }
    }
  });

  it("couplage parfait sur 128 sommets en temps raisonnable", () => {
    const rng = seededRng(5);
    const edges = randomGraph(rng, 128, 1, 1_000_000);
    const started = Date.now();
    const mate = maxWeightMatching(edges, true);
    assert.ok(mate.every((w) => w !== -1));
    assert.ok(Date.now() - started < 5000);
  });
});
