import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { wishlistTargetReached } from "../../src/lib/logic";

describe("wishlistTargetReached", () => {
  it("atteint quand le prix est égal ou inférieur à la cible (au centime près)", () => {
    assert.equal(wishlistTargetReached(10, 9.99), true);
    assert.equal(wishlistTargetReached(10, 10), true);
    assert.equal(wishlistTargetReached(10, 10.001), true);
    assert.equal(wishlistTargetReached(10, 10.01), false);
  });

  it("jamais atteint sans cible, sans prix ou avec un prix nul", () => {
    assert.equal(wishlistTargetReached(null, 5), false);
    assert.equal(wishlistTargetReached(10, null), false);
    assert.equal(wishlistTargetReached(10, 0), false);
    assert.equal(wishlistTargetReached(Number.NaN, 5), false);
  });
});
