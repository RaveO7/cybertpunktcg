/**
 * Côté serveur de la reprise de session (cf. specs/account/session) : la session mémorisée sur
 * l'appareil n'ouvre rien, seul le cookie compte, et une session supprimée en base est refusée (401),
 * ce qui ramène le client à l'écran de connexion. Compte de test supprimé à la fin, même en cas d'échec.
 */
import assert from "node:assert/strict";
import { POST as register } from "../src/app/api/auth/register/route";
import { POST as logout } from "../src/app/api/auth/logout/route";
import { GET as restoreSession } from "../src/app/api/auth/session/route";
import { GET as readCollection } from "../src/app/api/collection/route";
import { SESSION_COOKIE } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";
import { SESSION_USER_KEY, readSessionUser, writeSessionUser, type HintStorage } from "../src/lib/session-hint";
import type { AuthUser } from "../src/lib/types";

if (!process.env.DATABASE_URL?.startsWith("file:")) {
  throw new Error("DATABASE_URL doit pointer vers la base SQLite locale (file:...).");
}

const createdUserIds = new Set<string>();

// IP fictive propre à ce test : ses compteurs du limiteur (stockés en base) sont supprimés à la fin.
process.env.TRUST_PROXY = "1";
const testIp = `test-session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function request(path: string, token: string | null, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-forwarded-for", testIp);
  if (init.body) headers.set("content-type", "application/json");
  if (token) headers.set("cookie", `${SESSION_COOKIE}=${token}`);
  return new Request(`http://127.0.0.1${path}`, { ...init, headers });
}

function sessionToken(response: Response) {
  const line = response.headers.getSetCookie().find((item) => item.startsWith(`${SESSION_COOKIE}=`));
  assert.ok(line, "cookie de session absent");
  return decodeURIComponent(line.split(";")[0].slice(SESSION_COOKIE.length + 1));
}

function memoryStorage() {
  const data = new Map<string, string>();
  const storage: HintStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
  return { storage, data };
}

async function sessionStatus(token: string | null) {
  return (await restoreSession(request("/api/auth/session", token))).status;
}

async function collectionStatus(token: string | null) {
  return (await readCollection(request("/api/collection", token))).status;
}

async function main() {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const registered = await register(
    request("/api/auth/register", null, {
      method: "POST",
      body: JSON.stringify({ email: `reprise.${stamp}@example.com`, password: "motdepasse-robuste", displayName: "Reprise" }),
    }),
  );
  assert.equal(registered.status, 200, "création du compte");
  const { user } = (await registered.json()) as { user: AuthUser };
  createdUserIds.add(user.id);
  const token = sessionToken(registered);

  // (a) Session valide : la vérification renvoie un utilisateur que le client peut mémoriser tel quel.
  const verified = await restoreSession(request("/api/auth/session", token));
  assert.equal(verified.status, 200, "la session ouverte est reconnue");
  const verifiedUser = ((await verified.json()) as { user: AuthUser }).user;
  const device = memoryStorage();
  writeSessionUser(device.storage, verifiedUser);
  assert.deepEqual(readSessionUser(device.storage), user, "l'utilisateur vérifié se mémorise et se relit");
  assert.equal(await collectionStatus(token), 200, "la collection du compte se charge");

  // (d) Valeur mémorisée falsifiée, sans cookie : le serveur refuse tout, la mémoire n'ouvre rien.
  const forgedDevice = memoryStorage();
  forgedDevice.data.set(SESSION_USER_KEY, JSON.stringify(user));
  assert.ok(readSessionUser(forgedDevice.storage), "la valeur falsifiée est lisible côté client");
  assert.equal(await sessionStatus(null), 401, "sans cookie, la vérification répond 401");
  assert.equal(await collectionStatus(null), 401, "sans cookie, la collection répond 401");
  assert.equal(await sessionStatus("jeton-invente"), 401, "un cookie inventé est refusé à la vérification");
  assert.equal(await collectionStatus("jeton-invente"), 401, "un cookie inventé est refusé sur la collection");

  // (c) Session supprimée en base pendant que l'app est ouverte : refus au prochain appel.
  const deleted = await prisma.session.deleteMany({ where: { userId: user.id } });
  assert.ok(deleted.count > 0, "la session du compte existait en base");
  assert.equal(await sessionStatus(token), 401, "une session supprimée en base est refusée à la vérification");
  assert.equal(await collectionStatus(token), 401, "une session supprimée en base est refusée sur la collection");

  // (b) Déconnexion : le cookie n'ouvre plus la session.
  const relogged = await register(
    request("/api/auth/register", null, {
      method: "POST",
      body: JSON.stringify({ email: `reprise.b.${stamp}@example.com`, password: "motdepasse-robuste", displayName: "Reprise B" }),
    }),
  );
  assert.equal(relogged.status, 200, "création du second compte");
  createdUserIds.add(((await relogged.json()) as { user: AuthUser }).user.id);
  const tokenB = sessionToken(relogged);
  assert.equal(await sessionStatus(tokenB), 200);
  const loggedOut = await logout(request("/api/auth/logout", tokenB, { method: "POST" }));
  assert.equal(loggedOut.status, 200, "déconnexion");
  assert.equal(await sessionStatus(tokenB), 401, "après la déconnexion, la vérification répond 401");

  console.log("reprise de session : vérifications serveur OK");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.rateLimit.deleteMany({ where: { key: { endsWith: `:${testIp}` } } });
    const ids = [...createdUserIds];
    if (ids.length > 0) {
      await prisma.session.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.$disconnect();
  });
