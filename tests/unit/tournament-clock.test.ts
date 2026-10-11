import assert from "node:assert/strict";
import { describe, it } from "vitest";
import {
  adjustClock,
  clockOffsetMs,
  formatClock,
  pauseClock,
  remainingSeconds,
  resumeClock,
  roundDurationSeconds,
  startClock,
  type RoundClock,
} from "../../src/lib/tournament/clock";

const T0 = new Date("2026-10-10T19:00:00Z");
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const idle: RoundClock = { startedAt: null, durationSeconds: 50 * 60, pausedAt: null, pausedSeconds: 0, addedSeconds: 0 };

describe("chrono de ronde", () => {
  it("durée : ronde suisse et top cut (+25 min)", () => {
    assert.equal(roundDurationSeconds("swiss", 50, 25), 3000);
    assert.equal(roundDurationSeconds("top_cut", 50, 25), 4500);
  });

  it("démarre à 50:00 et décompte", () => {
    const clock = startClock(idle, T0);
    assert.equal(formatClock(remainingSeconds(clock, T0)), "50:00");
    assert.equal(formatClock(remainingSeconds(clock, at(10.5))), "39:30");
  });

  it("pas démarré : durée complète", () => {
    assert.equal(remainingSeconds(idle, at(30)), 3000);
  });

  it("pause de 5 minutes à 30:00 : reprend à 30:00", () => {
    let clock = startClock(idle, T0);
    clock = pauseClock(clock, at(20));
    assert.equal(remainingSeconds(clock, at(22)), 30 * 60, "figé pendant la pause");
    clock = resumeClock(clock, at(25));
    assert.equal(remainingSeconds(clock, at(25)), 30 * 60);
    assert.equal(remainingSeconds(clock, at(26)), 29 * 60);
  });

  it("pause et reprise répétées sont sans effet si déjà dans l'état", () => {
    const clock = pauseClock(startClock(idle, T0), at(1));
    assert.equal(pauseClock(clock, at(2)), clock);
    const running = startClock(idle, T0);
    assert.equal(resumeClock(running, at(2)), running);
  });

  it("ajout de 5 minutes à 10:00 restantes : 15:00", () => {
    const clock = adjustClock(startClock(idle, T0), 300, at(40));
    assert.equal(remainingSeconds(clock, at(40)), 15 * 60);
  });

  it("retrait de temps sans descendre sous zéro", () => {
    const clock = adjustClock(startClock(idle, T0), -3600, at(40));
    assert.equal(remainingSeconds(clock, at(40)), 0);
    assert.equal(remainingSeconds(clock, at(45)), 0);
  });

  it("temps supplémentaire d'une table", () => {
    const clock = startClock(idle, T0);
    assert.equal(remainingSeconds(clock, at(50)), 0, "temps écoulé pour le chrono général");
    assert.equal(remainingSeconds(clock, at(50), 240), 240, "la table 4 a encore 4 minutes");
  });

  it("téléphone en avance de 3 minutes : l'écart est corrigé", () => {
    // Le serveur répond 19:10:00 ; le téléphone a envoyé à 19:13:00 et reçu à 19:13:00.2 (son heure).
    const offset = clockOffsetMs(at(10).getTime(), at(13).getTime(), at(13).getTime() + 200);
    assert.equal(Math.round(offset / 1000), -180);
    const clock = startClock(idle, T0);
    const phoneNow = new Date(at(13).getTime() + offset);
    assert.equal(Math.round(remainingSeconds(clock, phoneNow)), 40 * 60);
  });
});
