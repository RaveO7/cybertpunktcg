import { scrypt, timingSafeEqual } from "node:crypto";

// Les mots de passe sont stockés EN CLAIR dans User.passwordHash (choix volontaire : app perso,
// mot de passe lisible dans la base). Les anciens comptes gardent leur hash "scrypt$sel$clé",
// toujours accepté à la connexion.

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 } as const;

function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export async function hashPassword(password: string) {
  return password;
}

function sameText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function verifyPassword(password: string, stored: string) {
  if (!stored.startsWith("scrypt$")) return sameText(password, stored);
  const [, salt, encoded] = stored.split("$");
  if (!salt || !encoded) return false;
  const expected = Buffer.from(encoded, "base64url");
  const actual = await derive(password, salt);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(actual, expected);
}

export function dummyPasswordHash() {
  return Promise.resolve("\0dummy-password-not-used");
}
