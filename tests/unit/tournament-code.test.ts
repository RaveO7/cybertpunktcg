import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  CODE_ALPHABET,
  generateTournamentCode,
  normalizePlayerName,
  normalizeTournamentCode,
  playerNameKey,
} from "../../src/lib/tournament/code";
import { seededRng, shuffle } from "../../src/lib/tournament/random";

describe("code de tournoi", () => {
  it("a 6 caractères tirés de l'alphabet sans ambiguïté", () => {
    for (const ambiguous of ["0", "O", "1", "I", "L"]) assert.equal(CODE_ALPHABET.includes(ambiguous), false);
    const rng = seededRng(42);
    for (let i = 0; i < 500; i += 1) {
      const code = generateTournamentCode(rng);
      assert.match(code, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/);
    }
  });

  it("se génère avec le hasard crypto par défaut", () => {
    assert.match(generateTournamentCode(), /^[A-Z2-9]{6}$/);
  });

  it("accepte la saisie en minuscules, avec espaces ou tiret", () => {
    assert.equal(normalizeTournamentCode("k7mq2x"), "K7MQ2X");
    assert.equal(normalizeTournamentCode(" K7M-Q2X "), "K7MQ2X");
  });

  it("refuse ce qui ne peut pas être un code", () => {
    assert.equal(normalizeTournamentCode("K7MQ2"), null);
    assert.equal(normalizeTournamentCode("K7MQ2XX"), null);
    assert.equal(normalizeTournamentCode("K0MQ2X"), null);
    assert.equal(normalizeTournamentCode(123456), null);
  });
});

describe("pseudos", () => {
  it("réduit les espaces et borne la longueur", () => {
    assert.equal(normalizePlayerName("  Neo   Anderson "), "Neo Anderson");
    assert.equal(normalizePlayerName("   "), null);
    assert.equal(normalizePlayerName("x".repeat(33)), null);
    assert.equal(normalizePlayerName(null), null);
  });

  it("compare sans casse, accents ni espaces superflus", () => {
    assert.equal(playerNameKey("Lúcas"), playerNameKey("lucas"));
    assert.equal(playerNameKey("  NEO  Anderson"), "neo anderson");
    assert.notEqual(playerNameKey("Lucas"), playerNameKey("Lucas B"));
  });
});

describe("hasard", () => {
  it("le générateur déterministe rejoue la même suite", () => {
    assert.deepEqual(shuffle([1, 2, 3, 4, 5], seededRng(7)), shuffle([1, 2, 3, 4, 5], seededRng(7)));
  });
});
