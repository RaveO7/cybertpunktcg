import { randomBytes } from "node:crypto";
import { shareTokenSchema } from "@/lib/api-schemas";

/** Jeton de lien partagé (classeur, deck) : 24 octets aléatoires en base64url, impossible à deviner. */
export function createShareToken() {
  return randomBytes(24).toString("base64url");
}

/** Format plausible : évite une requête en base pour une adresse visiblement fausse. */
export function isShareTokenFormat(token: string) {
  return shareTokenSchema.safeParse(token).success;
}
