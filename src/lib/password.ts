import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Mots de passe hachés en scrypt : "scrypt$sel$clé". Les comptes créés quand le mot de passe était
// stocké en clair restent acceptés, puis sont rehachés à leur connexion suivante (needsRehash).

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 } as const;
const PREFIX = "scrypt$";

function derive(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const key = await derive(password, salt);
  return `${PREFIX}${salt}$${key.toString("base64url")}`;
}

export function needsRehash(stored: string) {
  return !stored.startsWith(PREFIX);
}

function sameText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function verifyPassword(password: string, stored: string) {
  if (needsRehash(stored)) return sameText(password, stored);
  const [, salt, encoded] = stored.split("$");
  if (!salt || !encoded) return false;
  const expected = Buffer.from(encoded, "base64url");
  const actual = await derive(password, salt);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(actual, expected);
}

// Hash d'un secret aléatoire jamais divulgué : un e-mail inconnu coûte le même calcul scrypt qu'un
// compte existant, ce qui évite de deviner les comptes au temps de réponse.
let dummyHash: Promise<string> | undefined;

export function dummyPasswordHash() {
  dummyHash ??= hashPassword(randomBytes(32).toString("base64url"));
  return dummyHash;
}
