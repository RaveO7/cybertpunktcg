import { describe, expect, it } from "vitest";
import { firstRowMedia } from "../../src/lib/cards-preload";

describe("firstRowMedia", () => {
  it("précharge les deux premières cartes à toutes les largeurs", () => {
    expect(firstRowMedia(0)).toBeUndefined();
    expect(firstRowMedia(1)).toBeUndefined();
  });

  it("réserve les 3e et 4e cartes aux écrans où la grille a 3 puis 4 colonnes", () => {
    expect(firstRowMedia(2)).toBe("(min-width: 640px)");
    expect(firstRowMedia(3)).toBe("(min-width: 1024px)");
  });
});
