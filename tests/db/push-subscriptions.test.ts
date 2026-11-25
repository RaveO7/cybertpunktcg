/**
 * Abonnements Web Push des appareils : POST/DELETE /api/push/subscribe.
 * Comptes de test en @example.com, supprimés à la fin (cascade sur leurs abonnements) même en cas
 * d'échec ; les endpoints de test portent un identifiant unique et sont aussi supprimés explicitement.
 */
import assert from "node:assert/strict";
import { afterAll, beforeAll, describe, it } from "vitest";
import { DELETE as unsubscribeRoute, POST as subscribeRoute } from "../../src/app/api/push/subscribe/route";
import { SESSION_COOKIE, createSession, registerAccount } from "../../src/lib/auth";
import { MAX_PUSH_SUBSCRIPTIONS_PER_USER } from "../../src/lib/push";
import { prisma } from "../../src/lib/prisma";
import { cleanupCreatedRateLimits } from "../helpers/rate-limit";

const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const endpoint = (label: string) => `https://fcm.googleapis.com/fcm/send/${stamp}-${label}`;
const keys = { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" };
const createdUserIds: string[] = [];
let first: { id: string; token: string };
let second: { id: string; token: string };
let third: { id: string; token: string };

cleanupCreatedRateLimits();

function request(method: "POST" | "DELETE", body: unknown, session: string | null, referer?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (session) headers.set("cookie", `${SESSION_COOKIE}=${encodeURIComponent(session)}`);
  if (referer) headers.set("referer", referer);
  return new Request("http://127.0.0.1/api/push/subscribe", { method, headers, body: JSON.stringify(body) });
}

async function subscribe(body: unknown, session: string | null, referer?: string) {
  const response = await subscribeRoute(request("POST", body, session, referer));
  return { status: response.status, body: (await response.json()) as { active?: boolean; locale?: string } };
}

async function unsubscribe(body: unknown, session: string | null) {
  const response = await unsubscribeRoute(request("DELETE", body, session));
  return { status: response.status, body: (await response.json()) as { removed?: boolean } };
}

const row = (url: string) => prisma.pushSubscription.findUnique({ where: { endpoint: url } });

async function account(label: string) {
  const user = await registerAccount({
    email: `push.${label}.${stamp}@example.com`,
    password: "motdepasse-robuste",
    displayName: `Push ${label}`,
  });
  createdUserIds.push(user.id);
  return { id: user.id, token: (await createSession(user.id)).token };
}

beforeAll(async () => {
  first = await account("first");
  second = await account("second");
  third = await account("third");
});

afterAll(async () => {
  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: { startsWith: `https://fcm.googleapis.com/fcm/send/${stamp}-` } } });
  } finally {
    if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
});

describe.sequential("abonnements Web Push", () => {
  it("refuse sans session et rejette un abonnement invalide", async () => {
    assert.equal((await subscribe({ endpoint: endpoint("a"), keys }, null)).status, 401);
    assert.equal((await unsubscribe({ endpoint: endpoint("a") }, null)).status, 401);
    assert.equal((await subscribe({ endpoint: "http://fcm.googleapis.com/x", keys }, first.token)).status, 400);
    // Hôte hors des services push (SSRF) : refusé.
    assert.equal((await subscribe({ endpoint: "https://push.example.com/x", keys }, first.token)).status, 400);
    assert.equal((await subscribe({ endpoint: "https://169.254.169.254/x", keys }, first.token)).status, 400);
    assert.equal((await subscribe({ endpoint: endpoint("a"), keys: { p256dh: "a b", auth: "x" } }, first.token)).status, 400);
    assert.equal((await subscribe({ endpoint: endpoint("a") }, first.token)).status, 400);
    assert.equal(await row(endpoint("a")), null);
  });

  it("enregistre l'appareil avec sa langue, ou celle de la page à défaut", async () => {
    const created = await subscribe({ endpoint: endpoint("a"), keys, locale: "de" }, first.token);
    assert.equal(created.status, 200);
    assert.deepEqual(created.body, { active: true, locale: "de" });
    assert.equal((await row(endpoint("a")))?.userId, first.id);

    const fallback = await subscribe({ endpoint: endpoint("b"), keys, locale: "xx" }, first.token, "http://127.0.0.1/it/impostazioni");
    assert.equal(fallback.body.locale, "it");

    // Même endpoint : mise à jour, pas de doublon.
    await subscribe({ endpoint: endpoint("a"), keys, locale: "en" }, first.token);
    assert.equal((await row(endpoint("a")))?.locale, "en");
    assert.equal(await prisma.pushSubscription.count({ where: { userId: first.id } }), 2);
  });

  it("un endpoint d'un autre compte n'est pas écrasé sans les clés de l'appareil", async () => {
    const otherKeys = { p256dh: "BAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", auth: "zzzzzzzzzzzzzzzzzzzzzz" };
    const refused = await subscribe({ endpoint: endpoint("a"), keys: otherKeys, locale: "fr" }, second.token);
    assert.equal(refused.status, 409);
    const untouched = await row(endpoint("a"));
    assert.equal(untouched?.userId, first.id);
    assert.equal(untouched?.p256dh, keys.p256dh);
    assert.equal(untouched?.locale, "en");
  });

  it("un appareil partagé (mêmes clés) passe au compte qui s'y connecte", async () => {
    const moved = await subscribe({ endpoint: endpoint("a"), keys, locale: "fr" }, second.token);
    assert.equal(moved.status, 200);
    const current = await row(endpoint("a"));
    assert.equal(current?.userId, second.id);
    assert.equal(current?.locale, "fr");
    assert.equal(await prisma.pushSubscription.count({ where: { endpoint: endpoint("a") } }), 1);
  });

  it("plafonne les abonnements par compte en supprimant les plus anciens, puis limite le débit", async () => {
    const total = MAX_PUSH_SUBSCRIPTIONS_PER_USER + 2;
    for (let index = 0; index < total; index += 1) {
      assert.equal((await subscribe({ endpoint: endpoint(`cap-${index}`), keys }, third.token)).status, 200);
      // createdAt distinct : l'ordre d'ancienneté ne doit pas dépendre de la milliseconde.
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const kept = await prisma.pushSubscription.findMany({ where: { userId: third.id }, select: { endpoint: true } });
    assert.equal(kept.length, MAX_PUSH_SUBSCRIPTIONS_PER_USER);
    assert.equal(await row(endpoint("cap-0")), null);
    assert.equal(await row(endpoint("cap-1")), null);
    assert.ok(await row(endpoint(`cap-${total - 1}`)));

    // 20 abonnements par 10 minutes et par compte : les 8 restants passent, le suivant est refusé.
    for (let index = total; index < 20; index += 1) {
      assert.equal((await subscribe({ endpoint: endpoint(`cap-${index}`), keys }, third.token)).status, 200);
    }
    const limited = await subscribeRoute(request("POST", { endpoint: endpoint("cap-over"), keys }, third.token));
    assert.equal(limited.status, 429);
    assert.equal(await row(endpoint("cap-over")), null);
  });

  it("désabonnement : seulement l'appareil du compte courant", async () => {
    const foreign = await unsubscribe({ endpoint: endpoint("a") }, first.token);
    assert.deepEqual(foreign.body, { removed: false });
    assert.ok(await row(endpoint("a")));

    const own = await unsubscribe({ endpoint: endpoint("a") }, second.token);
    assert.equal(own.status, 200);
    assert.deepEqual(own.body, { removed: true });
    assert.equal(await row(endpoint("a")), null);
  });

  it("supprimer le compte supprime ses abonnements", async () => {
    await subscribe({ endpoint: endpoint("c"), keys }, first.token);
    assert.equal(await prisma.pushSubscription.count({ where: { userId: first.id } }), 2);
    await prisma.user.delete({ where: { id: first.id } });
    assert.equal(await prisma.pushSubscription.count({ where: { userId: first.id } }), 0);
    assert.equal(await row(endpoint("b")), null);
  });
});
