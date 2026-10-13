import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { safeNextPath } from "../../src/lib/safe-next";

describe("retour après connexion", () => {
  it("accepte un chemin relatif du site, query comprise", () => {
    assert.equal(safeNextPath("/cards?printing=abc"), "/cards?printing=abc");
    assert.equal(safeNextPath("/tournois/publics"), "/tournois/publics");
  });

  it("refuse les URL absolues et les redirections ouvertes", () => {
    for (const raw of [
      "https://evil.example.com",
      "//evil.example.com",
      "/\\evil.example.com",
      "javascript:alert(1)",
      "evil.example.com",
      "\t//evil.example.com",
      "/\u0000//evil.example.com",
    ]) {
      assert.equal(safeNextPath(raw), "/", raw);
    }
  });

  it("défaut : l'accueil (vide, ou la page de connexion elle-même)", () => {
    assert.equal(safeNextPath(null), "/");
    assert.equal(safeNextPath(""), "/");
    assert.equal(safeNextPath("/connexion?next=/x"), "/");
  });
});
