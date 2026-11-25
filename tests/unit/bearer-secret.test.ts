import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { hasBearerSecret } from "../../src/lib/bearer-secret";

const requestWith = (authorization?: string) =>
  new Request("http://127.0.0.1/api/x", { headers: authorization === undefined ? {} : { authorization } });

describe("hasBearerSecret", () => {
  it("accepte « Bearer <secret> » exact", () => {
    assert.equal(hasBearerSecret(requestWith("Bearer s3cret"), "s3cret"), true);
  });

  it("nettoie les espaces autour du secret attendu", () => {
    assert.equal(hasBearerSecret(requestWith("Bearer s3cret"), "  s3cret\n"), true);
  });

  it("refuse toujours quand le secret est absent, vide ou blanc", () => {
    for (const secret of [undefined, "", "   "]) {
      for (const header of [undefined, "", "Bearer", "Bearer ", "Bearer    ", "Bearer undefined"]) {
        assert.equal(hasBearerSecret(requestWith(header), secret), false, `${JSON.stringify(secret)} / ${JSON.stringify(header)}`);
      }
    }
  });

  it("refuse un mauvais secret, de même longueur ou non", () => {
    assert.equal(hasBearerSecret(requestWith("Bearer s3creT"), "s3cret"), false);
    assert.equal(hasBearerSecret(requestWith("Bearer s3cre"), "s3cret"), false);
    assert.equal(hasBearerSecret(requestWith("Bearer s3cret2"), "s3cret"), false);
  });

  it("refuse un en-tête absent ou mal formé", () => {
    for (const header of [undefined, "", "s3cret", "bearer s3cret", "Basic s3cret", "Bearer  s3cret"]) {
      assert.equal(hasBearerSecret(requestWith(header), "s3cret"), false, JSON.stringify(header));
    }
  });
});
