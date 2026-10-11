// Code d'accès d'un tournoi et pseudos normalisés.

import { cryptoRng, randomInt, type Rng } from "./random";

/** Sans caractères ambigus : ni 0/O, ni 1/I/L. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 6;

export function generateTournamentCode(rng: Rng = cryptoRng) {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) code += CODE_ALPHABET[randomInt(rng, CODE_ALPHABET.length)];
  return code;
}

/** Code saisi par un joueur → forme canonique, ou null s'il ne peut pas être un code. */
export function normalizeTournamentCode(value: unknown) {
  if (typeof value !== "string") return null;
  const code = value.replace(/[\s-]/g, "").toUpperCase();
  if (code.length !== CODE_LENGTH) return null;
  for (const char of code) if (!CODE_ALPHABET.includes(char)) return null;
  return code;
}

export const PLAYER_NAME_MAX = 32;

/** Pseudo affiché : espaces réduits, 1 à 32 caractères. */
export function normalizePlayerName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > PLAYER_NAME_MAX) return null;
  return name;
}

/** Clé d'unicité d'un pseudo dans un tournoi : sans casse, accents ni espaces superflus. */
export function playerNameKey(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}
