/**
 * Régression du second audit sécurité.
 * Échoue si les failles reproduites avant correctif réapparaissent.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { registerAccount } from "../src/lib/auth";
import { appOrigin, createOAuthState, loginWithOAuth, verifyOAuthState } from "../src/lib/oauth";
import { saveCollectionBatch } from "../src/lib/collection-mutate";
import { clientKey, rateLimit } from "../src/lib/rate-limit";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as register } from "../src/app/api/auth/register/route";

const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const cleanupIds: string[] = [];
// Toutes les IP fictives finissent par le stamp : leurs compteurs du limiteur sont supprimés à la fin.
const testIp = `test-audit2-${stamp}`;
const password = "motdepasse-robuste";

async function testOAuthEmailAutolinkBlocked() {
  const email = `secure.oauth.${stamp}@example.com`;
  const victim = await registerAccount({
    email,
    password,
    displayName: "Victime",
    localUserId: null,
  });
  cleanupIds.push(victim.id);

  await assert.rejects(
    () =>
      loginWithOAuth(
        {
          provider: "google",
          providerUserId: `google-attacker-${stamp}`,
          email,
          displayName: "Attaquant",
        },
        null,
      ),
    (error: unknown) => error instanceof Error && error.message === "ACCOUNT_EXISTS",
  );

  const linked = await prisma.oAuthAccount.findFirst({
    where: { userId: victim.id, provider: "google" },
  });
  assert.equal(linked, null, "aucune identité OAuth ne doit être liée silencieusement");
}

async function testOAuthStateRequiresSecret() {
  const prevSecret = process.env.OAUTH_STATE_SECRET;
  const prevGoogle = process.env.GOOGLE_CLIENT_SECRET;
  const prevApple = process.env.APPLE_CLIENT_ID;
  delete process.env.OAUTH_STATE_SECRET;
  delete process.env.GOOGLE_CLIENT_SECRET;
  delete process.env.APPLE_CLIENT_ID;

  try {
    assert.throws(() => createOAuthState("google", null), /OAUTH_STATE_SECRET_MISSING/);

    const body = Buffer.from(
      JSON.stringify({ n: "x", p: "google", l: null, e: Date.now() + 60_000 }),
      "utf8",
    ).toString("base64url");
    const sig = createHmac("sha256", "cptcg-dev-oauth-state").update(body).digest("base64url");
    assert.equal(verifyOAuthState(`${body}.${sig}`, "google"), null, "state signé avec le vieux secret hardcodé");
  } finally {
    if (prevSecret !== undefined) process.env.OAUTH_STATE_SECRET = prevSecret;
    else delete process.env.OAUTH_STATE_SECRET;
    if (prevGoogle !== undefined) process.env.GOOGLE_CLIENT_SECRET = prevGoogle;
    if (prevApple !== undefined) process.env.APPLE_CLIENT_ID = prevApple;
  }

  process.env.OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || `test-oauth-secret-${stamp}-xx`;
  const state = createOAuthState("google", null);
  assert.ok(verifyOAuthState(state, "google"));
}

function testForwardedHostIgnoredWithoutTrustProxy() {
  const prevApp = process.env.APP_URL;
  const prevTrust = process.env.TRUST_PROXY;
  delete process.env.APP_URL;
  delete process.env.TRUST_PROXY;
  try {
    const request = new Request("http://127.0.0.1:3000/api/auth/oauth/google", {
      headers: {
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https",
      },
    });
    assert.equal(appOrigin(request), "http://127.0.0.1:3000");
  } finally {
    if (prevApp !== undefined) process.env.APP_URL = prevApp;
    else delete process.env.APP_URL;
    if (prevTrust !== undefined) process.env.TRUST_PROXY = prevTrust;
    else delete process.env.TRUST_PROXY;
  }
}

async function testOrphanClaimBlocked() {
  const orphan = await prisma.user.create({ data: { displayName: "Orphelin" } });
  cleanupIds.push(orphan.id);
  const printing = await prisma.printing.findFirst({ where: { isActive: true }, select: { id: true } });
  const condition = await prisma.condition.findFirst({ select: { id: true } });
  assert.ok(printing && condition);
  await prisma.collectionItem.create({
    data: {
      userId: orphan.id,
      printingId: printing.id,
      conditionId: condition.id,
      quantity: 9,
      notes: "a-voler",
    },
  });

  const viaRegister = await registerAccount({
    email: `orphan.reg.${stamp}@example.com`,
    password,
    displayName: "Reg",
    localUserId: orphan.id,
  });
  cleanupIds.push(viaRegister.id);
  assert.notEqual(viaRegister.id, orphan.id);
  assert.ok(await prisma.user.findUnique({ where: { id: orphan.id } }));

  const attackerLogin = await login(
    new Request("http://127.0.0.1/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": testIp },
      body: JSON.stringify({
        email: `orphan.login.${stamp}@example.com`,
        password,
        localUserId: orphan.id,
      }),
    }),
  );
  // Compte inexistant → 401; pas de fusion même avec un localUserId connu.
  assert.equal(attackerLogin.status, 401);

  const attacker = await registerAccount({
    email: `orphan.atk.${stamp}@example.com`,
    password,
    displayName: "Atk",
    localUserId: orphan.id,
  });
  cleanupIds.push(attacker.id);
  assert.equal(
    await prisma.collectionItem.findFirst({ where: { userId: attacker.id, notes: "a-voler" } }),
    null,
  );
  assert.ok(await prisma.user.findUnique({ where: { id: orphan.id } }));

  const regWithLocal = await register(
    new Request("http://127.0.0.1/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": testIp },
      body: JSON.stringify({
        email: `orphan.api.${stamp}@example.com`,
        password,
        displayName: "Api",
        localUserId: orphan.id,
      }),
    }),
  );
  assert.equal(regWithLocal.status, 200);
  const regBody = (await regWithLocal.json()) as { user: { id: string } };
  cleanupIds.push(regBody.user.id);
  assert.notEqual(regBody.user.id, orphan.id);
  assert.equal(
    await prisma.collectionItem.findFirst({ where: { userId: regBody.user.id, notes: "a-voler" } }),
    null,
  );
}

async function testBulkRejectsEarly() {
  const user = await registerAccount({
    email: `bulk.secure.${stamp}@example.com`,
    password,
    displayName: "Bulk",
    localUserId: null,
  });
  cleanupIds.push(user.id);
  const huge = Array.from({ length: 401 }, (_, i) => ({ printingId: `fake-${i}`, quantity: 1 }));
  await assert.rejects(
    () => saveCollectionBatch(user.id, { conditionCode: "NM", lines: huge }),
    (error: unknown) => error instanceof Error && /Trop de cartes/i.test(error.message),
  );
}

async function testLoginRateLimit() {
  // IP fictive unique : le compteur est en base, partagé, et doit être nettoyé ensuite.
  const previousTrustProxy = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = "1";
  const attackerIp = `203.0.113.${Math.floor(Math.random() * 200) + 1}-${stamp}`;
  const otherIp = `198.51.100.7-${stamp}`;
  try {
    const email = `rate.${stamp}@example.com`;
    await registerAccount({ email, password, displayName: "Rate", localUserId: null }).then((user) => {
      cleanupIds.push(user.id);
    });

    const attempt = (ip: string, pass: string) =>
      login(
        new Request("http://127.0.0.1/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": `${ip}, 10.0.0.1` },
          body: JSON.stringify({ email, password: pass }),
        }),
      );

    let hit429 = false;
    for (let i = 0; i < 25; i += 1) {
      const response = await attempt(attackerIp, "mauvais-mot-de-passe");
      if (response.status === 429) {
        hit429 = true;
        break;
      }
    }
    assert.equal(hit429, true, "le login doit finir en 429 sous rafale");
    // Un autre visiteur ne doit pas être bloqué par les échecs du premier.
    const other = await attempt(otherIp, password);
    assert.equal(other.status, 200, "une autre IP ne doit pas être bloquée");
    assert.equal(clientKey(new Request("http://x/", { headers: { "x-forwarded-for": otherIp } }), "probe"), `probe:${otherIp}`);
    assert.equal((await rateLimit(`probe:${otherIp}`, 1, 1000)).ok, true);
    assert.equal((await rateLimit(`probe:${otherIp}`, 1, 1000)).ok, false);
  } finally {
    if (previousTrustProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previousTrustProxy;
  }
}

async function testOAuthCreatesNewUserWhenEmailFree() {
  process.env.OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || `test-oauth-secret-${stamp}-xx`;
  const email = `oauth.new.${stamp}@example.com`;
  const user = await loginWithOAuth(
    {
      provider: "google",
      providerUserId: `google-new-${stamp}`,
      email,
      displayName: "OAuth New",
    },
    null,
  );
  cleanupIds.push(user.id);
  assert.equal(user.email, email);
  const link = await prisma.oAuthAccount.findFirst({ where: { userId: user.id, provider: "google" } });
  assert.ok(link);
}

async function main() {
  process.env.TRUST_PROXY = "1";
  process.env.OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || `test-oauth-secret-${stamp}-xx`;
  await testOAuthEmailAutolinkBlocked();
  await testOAuthStateRequiresSecret();
  testForwardedHostIgnoredWithoutTrustProxy();
  await testOrphanClaimBlocked();
  await testBulkRejectsEarly();
  await testLoginRateLimit();
  await testOAuthCreatesNewUserWhenEmailFree();
  console.log(JSON.stringify({ ok: true, audit: 2 }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.rateLimit.deleteMany({ where: { key: { endsWith: `-${stamp}` } } });
    if (cleanupIds.length) {
      await prisma.oAuthAccount.deleteMany({ where: { userId: { in: cleanupIds } } });
      await prisma.collectionItem.deleteMany({ where: { userId: { in: cleanupIds } } });
      await prisma.session.deleteMany({ where: { userId: { in: cleanupIds } } });
      await prisma.user.deleteMany({ where: { id: { in: cleanupIds } } });
    }
    await prisma.$disconnect();
  });
