// Chrono de ronde calculé à partir de l'heure du serveur (cf. specs/tournaments/round-clock).
// Le chrono ne clôture jamais une ronde : il ne sert qu'à l'affichage.

import type { Phase } from "./scores";

export type RoundClock = {
  startedAt: Date | null;
  durationSeconds: number;
  pausedAt: Date | null;
  pausedSeconds: number;
  addedSeconds: number;
};

export function roundDurationSeconds(phase: Phase, roundMinutes: number, topCutExtraMinutes: number) {
  return (roundMinutes + (phase === "top_cut" ? topCutExtraMinutes : 0)) * 60;
}

function elapsedSeconds(clock: RoundClock, now: Date) {
  if (!clock.startedAt) return 0;
  const end = clock.pausedAt ?? now;
  return Math.max(0, (end.getTime() - clock.startedAt.getTime()) / 1000 - clock.pausedSeconds);
}

/** Temps restant (secondes, jamais négatif), avec le temps supplémentaire d'une table. */
export function remainingSeconds(clock: RoundClock, now: Date, extraSeconds = 0) {
  return Math.max(0, clock.durationSeconds + clock.addedSeconds + extraSeconds - elapsedSeconds(clock, now));
}

export function startClock(clock: RoundClock, now: Date): RoundClock {
  return { ...clock, startedAt: now, pausedAt: null, pausedSeconds: 0 };
}

export function pauseClock(clock: RoundClock, now: Date): RoundClock {
  if (!clock.startedAt || clock.pausedAt) return clock;
  return { ...clock, pausedAt: now };
}

export function resumeClock(clock: RoundClock, now: Date): RoundClock {
  if (!clock.pausedAt) return clock;
  const paused = Math.round((now.getTime() - clock.pausedAt.getTime()) / 1000);
  return { ...clock, pausedAt: null, pausedSeconds: clock.pausedSeconds + paused };
}

/** Ajoute (ou retire) du temps à la ronde, sans descendre sous zéro. */
export function adjustClock(clock: RoundClock, deltaSeconds: number, now: Date): RoundClock {
  const remaining = remainingSeconds(clock, now);
  const delta = Math.max(deltaSeconds, -Math.floor(remaining));
  return { ...clock, addedSeconds: clock.addedSeconds + delta };
}

/** Écart entre l'horloge du serveur et celle de l'appareil (ms), mesuré sur un aller-retour. */
export function clockOffsetMs(serverNowMs: number, sentAtMs: number, receivedAtMs: number) {
  return serverNowMs - (sentAtMs + receivedAtMs) / 2;
}

/** « 49:05 » */
export function formatClock(seconds: number) {
  const total = Math.ceil(seconds);
  const minutes = Math.floor(total / 60);
  return `${minutes}:${String(total % 60).padStart(2, "0")}`;
}
