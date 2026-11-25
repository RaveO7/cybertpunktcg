/**
 * Noms des cookies de session, partagés par le proxy, l'authentification et le script de démarrage.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "vitest";
import { SESSION_COOKIE, SESSION_HINT_COOKIE } from "../../src/lib/session-cookie";

// Jeton de nom de cookie (RFC 6265 / RFC 9110) : caractères visibles hors séparateurs.
const COOKIE_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

describe("session-cookie", () => {
  it("garde les noms en place : les changer déconnecterait toutes les sessions ouvertes", () => {
    assert.equal(SESSION_COOKIE, "cptcg_session");
    assert.equal(SESSION_HINT_COOKIE, "cptcg_signed");
  });

  it("des noms de cookie valides et distincts", () => {
    assert.match(SESSION_COOKIE, COOKIE_NAME);
    assert.match(SESSION_HINT_COOKIE, COOKIE_NAME);
    assert.notEqual(SESSION_COOKIE, SESSION_HINT_COOKIE);
  });

  it("l'indicateur se cherche sans échappement dans document.cookie, sans confusion avec la session", () => {
    // Même motif que le script du <head> (src/lib/boot-requests.ts), où le nom est inséré tel quel.
    const hint = new RegExp(`(?:^|;\\s*)${SESSION_HINT_COOKIE}=`);
    assert.equal(hint.test(`theme=dark; ${SESSION_HINT_COOKIE}=1`), true);
    assert.equal(hint.test(`${SESSION_HINT_COOKIE}=1`), true);
    assert.equal(hint.test(`${SESSION_COOKIE}=jeton`), false);
    assert.equal(hint.test(`x${SESSION_HINT_COOKIE}=1`), false);
  });

  it("reste sans dépendance : importable depuis le proxy comme depuis le serveur", () => {
    const source = readFileSync(new URL("../../src/lib/session-cookie.ts", import.meta.url), "utf8");
    assert.doesNotMatch(source, /^\s*import\s/m);
  });
});
