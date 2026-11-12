/**
 * Grille de la collection : seules les cartes de la première rangée chargent leur image en priorité (LCP).
 */
import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { isPriorityCard } from "../../src/components/VirtualCardGrid";

function priorityIndexes(count: number, cols: number) {
  return Array.from({ length: count }, (_, index) => index).filter((index) => isPriorityCard(index, cols));
}

describe("isPriorityCard", () => {
  it("garde la première rangée selon le nombre de colonnes", () => {
    assert.deepEqual(priorityIndexes(20, 4), [0, 1, 2, 3]);
    assert.deepEqual(priorityIndexes(20, 3), [0, 1, 2]);
    assert.deepEqual(priorityIndexes(20, 2), [0, 1]);
  });

  it("ne dépasse pas le nombre de cartes", () => {
    assert.deepEqual(priorityIndexes(1, 4), [0]);
    assert.deepEqual(priorityIndexes(0, 4), []);
  });
});
