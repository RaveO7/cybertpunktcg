/**
 * Suppression du compte (exigée par Google Play) : confirmation obligatoire, session requise, données
 * effacées en cascade et cookie de session retiré.
 */
import assert from "node:assert/strict";
import { afterAll, describe, it } from "vitest";
import { DELETE as deleteAccountRoute } from "../../src/app/api/auth/account/route";
import { SESSION_COOKIE, createSession, registerAccount } from "../../src/lib/auth";
import { prisma } from "../../src/lib/prisma";

const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const createdUserIds: string[] = [];

async function makeAccount(label: string) {
  const user = await registerAccount({
    email: `suppression.${label}.${stamp}@example.com`,
    password: "motdepasse-robuste",
    displayName: `Suppression ${label}`,
  });
  createdUserIds.push(user.id);
  return { id: user.id, token: (await createSession(user.id)).token };
}

function deleteRequest(token: string | null, body?: unknown) {
  const headers = new Headers({ "content-type": "application/json" });
  if (token) headers.set("cookie", `${SESSION_COOKIE}=${encodeURIComponent(token)}`);
  return new Request("http://127.0.0.1/api/auth/account", {
    method: "DELETE",
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

afterAll(async () => {
  if (createdUserIds.length) await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.$disconnect();
});

describe("DELETE /api/auth/account", () => {
  it("refuse sans session", async () => {
    const response = await deleteAccountRoute(deleteRequest(null, { confirm: true }));
    assert.equal(response.status, 401);
  });

  it("refuse sans confirmation explicite et garde le compte", async () => {
    const account = await makeAccount("sans-confirmation");
    for (const body of [undefined, {}, { confirm: "true" }, { confirm: false }]) {
      const response = await deleteAccountRoute(deleteRequest(account.token, body));
      assert.equal(response.status, 400, `corps ${JSON.stringify(body)} accepté`);
    }
    assert.ok(await prisma.user.findUnique({ where: { id: account.id } }), "le compte ne doit pas être supprimé");
  });

  it("supprime le compte, ses données et la session", async () => {
    const account = await makeAccount("confirme");
    const other = await makeAccount("autre");
    await prisma.deck.create({ data: { userId: account.id, name: "Deck à supprimer" } });
    await prisma.collectionShare.create({ data: { userId: account.id, token: `share-${stamp}-${account.id}` } });

    const response = await deleteAccountRoute(deleteRequest(account.token, { confirm: true }));
    assert.equal(response.status, 200);
    const cookie = response.headers.getSetCookie().find((line) => line.startsWith(`${SESSION_COOKIE}=`));
    assert.ok(cookie && /Max-Age=0/i.test(cookie), "le cookie de session doit être effacé");

    assert.equal(await prisma.user.count({ where: { id: account.id } }), 0);
    assert.equal(await prisma.session.count({ where: { userId: account.id } }), 0);
    assert.equal(await prisma.deck.count({ where: { userId: account.id } }), 0);
    assert.equal(await prisma.collectionShare.count({ where: { userId: account.id } }), 0);
    assert.equal(await prisma.user.count({ where: { id: other.id } }), 1, "les autres comptes restent");

    const replay = await deleteAccountRoute(deleteRequest(account.token, { confirm: true }));
    assert.equal(replay.status, 401, "la session du compte supprimé ne doit plus servir");
  });
});
