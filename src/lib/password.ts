import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

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
  const salt = randomBytes(16).toString("base64url");
  const key = await derive(password, salt);
  return `scrypt$${salt}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [scheme, salt, encoded] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !encoded) return false;
  const expected = Buffer.from(encoded, "base64url");
  const actual = await derive(password, salt);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(actual, expected);
}

let dummyHash: Promise<string> | null = null;

export function dummyPasswordHash() {
  dummyHash ??= hashPassword("dummy-password-not-used");
  return dummyHash;
}
