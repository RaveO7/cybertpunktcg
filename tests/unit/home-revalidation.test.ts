import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { changesHomeDirectory, revalidateHome } from "../../src/lib/home-revalidation";

describe("changesHomeDirectory", () => {
  it("écritures des tables de l'annuaire seulement", () => {
    assert.equal(changesHomeDirectory("Tournament", "update"), true);
    assert.equal(changesHomeDirectory("TournamentPlayer", "deleteMany"), true);
    assert.equal(changesHomeDirectory("Shop", "upsert"), true);
    assert.equal(changesHomeDirectory("Tournament", "findMany"), false);
    assert.equal(changesHomeDirectory("User", "update"), false);
    assert.equal(changesHomeDirectory(undefined, "update"), false);
  });
});

describe("revalidateHome", () => {
  it("sans effet hors d'une requête Next (script, test)", () => {
    assert.doesNotThrow(() => revalidateHome());
  });
});
