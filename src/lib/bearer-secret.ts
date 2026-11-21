import { timingSafeEqual } from "node:crypto";

/** « Authorization: Bearer <secret> » exact, comparé en temps constant ; secret absent ou blanc : toujours refusé. */
export function hasBearerSecret(request: Request, secret: string | undefined) {
  const expectedSecret = secret?.trim();
  if (!expectedSecret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${expectedSecret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
