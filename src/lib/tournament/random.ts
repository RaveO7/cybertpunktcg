// Hasard injectable : la production tire avec crypto, les tests passent un générateur déterministe.

/** Retourne un nombre dans [0, 1). */
export type Rng = () => number;

export const cryptoRng: Rng = () => {
  const buffer = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buffer);
  return buffer[0] / 2 ** 32;
};

/** Générateur déterministe (mulberry32) pour les tests. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

export function randomInt(rng: Rng, maxExclusive: number) {
  return Math.floor(rng() * maxExclusive);
}

/** Mélange de Fisher-Yates (copie). */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomInt(rng, i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
