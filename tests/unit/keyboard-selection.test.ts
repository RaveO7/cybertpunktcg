import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { neighborIndex, rangeIds } from "../../src/components/cards-explorer/use-keyboard-selection";

describe("neighborIndex", () => {
  it("droite et gauche suivent l'ordre de la liste, d'une ligne à l'autre", () => {
    assert.equal(neighborIndex(3, "ArrowRight", 4, 10), 4);
    assert.equal(neighborIndex(4, "ArrowLeft", 4, 10), 3);
  });

  it("reste sur place aux bords de la liste", () => {
    assert.equal(neighborIndex(0, "ArrowLeft", 4, 10), 0);
    assert.equal(neighborIndex(9, "ArrowRight", 4, 10), 9);
    assert.equal(neighborIndex(1, "ArrowUp", 4, 10), 1);
  });

  it("haut et bas sautent d'une ligne selon le nombre de colonnes", () => {
    assert.equal(neighborIndex(1, "ArrowDown", 2, 10), 3);
    assert.equal(neighborIndex(1, "ArrowDown", 3, 10), 4);
    assert.equal(neighborIndex(1, "ArrowDown", 4, 10), 5);
    assert.equal(neighborIndex(5, "ArrowUp", 4, 10), 1);
    assert.equal(neighborIndex(5, "ArrowUp", 2, 10), 3);
  });

  it("vers le bas sous une colonne vide de la dernière ligne : dernière carte", () => {
    // 10 cartes sur 4 colonnes : la dernière ligne n'a que les colonnes 0 et 1.
    assert.equal(neighborIndex(7, "ArrowDown", 4, 10), 9);
    // Déjà sur la dernière ligne : on ne bouge pas.
    assert.equal(neighborIndex(9, "ArrowDown", 4, 10), 9);
    assert.equal(neighborIndex(8, "ArrowDown", 4, 10), 8);
  });

  it("Début et Fin vont à la première et à la dernière carte", () => {
    assert.equal(neighborIndex(5, "Home", 4, 10), 0);
    assert.equal(neighborIndex(5, "End", 4, 10), 9);
  });

  it("ignore les autres touches et les listes vides", () => {
    assert.equal(neighborIndex(2, "a", 4, 10), null);
    assert.equal(neighborIndex(0, "ArrowRight", 4, 0), null);
  });

  it("une seule colonne : haut et bas passent à la carte voisine", () => {
    assert.equal(neighborIndex(2, "ArrowDown", 1, 5), 3);
    assert.equal(neighborIndex(2, "ArrowUp", 0, 5), 1);
  });
});

describe("rangeIds", () => {
  const items = ["a", "b", "c", "d", "e"].map((id) => ({ id }));

  it("prend les cartes entre deux positions, dans les deux sens", () => {
    assert.deepEqual(rangeIds(items, 1, 3), ["b", "c", "d"]);
    assert.deepEqual(rangeIds(items, 3, 1), ["b", "c", "d"]);
    assert.deepEqual(rangeIds(items, 2, 2), ["c"]);
  });
});
