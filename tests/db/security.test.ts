/**
 * Régression du second audit sécurité.
 * Échoue si les failles reproduites avant correctif réapparaissent.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, it } from "vitest";
import { POST as login } from "../../src/app/api/auth/login/route";
import { POST as register } from "../../src/app/api/auth/register/route";
import { registerAccount } from "../../src/lib/auth";
import { saveCollectionBatch } from "../../src/lib/collection-mutate";
import { appOrigin, createOAuthState, loginWithOAuth, verifyOAuthState } from "../../src/lib/oauth";
import { prisma } from "../../src/lib/prisma";
import { clientKey, rateLimit } from "../../src/lib/rate-limit";
import { cleanupCreatedRateLimits } from "../helpers/rate-limit";

const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const cleanupIds: string[] = [];
const password = "motdepasse-robuste";

/** Restaure les variables d'environnement modifiées par un test. */
function withEnv(values: Record<string, string | undefined>, run: () => void) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  const apply = (entries: Record<string, string | undefined>) => {
    for (const [key, value] of Object.entries(entries)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
  apply(values);
  try {
    run();
  } finally {
    apply(previous);
  }
}

cleanupCreatedRateLimits();

beforeAll(() => {
  process.env.OAUTH_STATE_SECRET = process.env.OAUTH_STATE_SECRET || `test-oauth-secret-${stamp}-xx`;
});

afterAll(async () => {
  if (cleanupIds.length) {
    await prisma.user.deleteMany({ where: { id: { in: cleanupIds } } });
  }
  await prisma.$disconnect();
});

describe("OAuth", () => {
  it("ne rattache pas silencieusement un compte existant par e-mail", async () => {
    const email = `secure.oauth.${stamp}@example.com`;
    const victim = await registerAccount({ email, password, displayName: "Victime", localUserId: null });
    cleanupIds.push(victim.id);

    await assert.rejects(
      () =>
        loginWithOAuth(
          { provider: "google", providerUserId: `google-attacker-${stamp}`, email, displayName: "Attaquant" },
          null,
        ),
      (error: unknown) => error instanceof Error && error.message === "ACCOUNT_EXISTS",
    );
    const linked = await prisma.oAuthAccount.findFirst({ where: { userId: victim.id, provider: "google" } });
    assert.equal(linked, null, "aucune identité OAuth ne doit être liée silencieusement");
  });

  it("exige un secret pour signer le state", () => {
    withEnv({ OAUTH_STATE_SECRET: undefined, GOOGLE_CLIENT_SECRET: undefined, APPLE_CLIENT_ID: undefined }, () => {
      assert.throws(() => createOAuthState("google", null), /OAUTH_STATE_SECRET_MISSING/);
      const body = Buffer.from(
        JSON.stringify({ n: "x", p: "google", l: null, e: Date.now() + 60_000 }),
        "utf8",
      ).toString("base64url");
      const sig = createHmac("sha256", "cptcg-dev-oauth-state").update(body).digest("base64url");
      assert.equal(verifyOAuthState(`${body}.${sig}`, "google"), null, "state signé avec le vieux secret hardcodé");
    });
    const state = createOAuthState("google", null);
    assert.ok(verifyOAuthState(state, "google"));
  });

  it("ignore x-forwarded-host sans TRUST_PROXY", () => {
    withEnv({ APP_URL: undefined, TRUST_PROXY: undefined }, () => {
      const request = new Request("http://127.0.0.1:3000/api/auth/oauth/google", {
        headers: { "x-forwarded-host": "evil.example", "x-forwarded-proto": "https" },
      });
      assert.equal(appOrigin(request), "http://127.0.0.1:3000");
    });
  });

  it("crée un nouveau compte quand l'e-mail est libre", async () => {
    const email = `oauth.new.${stamp}@example.com`;
    const user = await loginWithOAuth(
      { provider: "google", providerUserId: `google-new-${stamp}`, email, displayName: "OAuth New" },
      null,
    );
    cleanupIds.push(user.id);
    assert.equal(user.email, email);
    assert.ok(await prisma.oAuthAccount.findFirst({ where: { userId: user.id, provider: "google" } }));
  });
});

describe("collection orpheline", () => {
  it("ne peut être réclamée ni à l'inscription ni à la connexion", async () => {
    const orphan = await prisma.user.create({ data: { displayName: "Orphelin" } });
    cleanupIds.push(orphan.id);
    const printing = await prisma.printing.findFirst({ where: { isActive: true }, select: { id: true } });
    const condition = await prisma.condition.findFirst({ select: { id: true } });
    assert.ok(printing && condition);
    await prisma.collectionItem.create({
      data: { userId: orphan.id, printingId: printing.id, conditionId: condition.id, quantity: 9, notes: "a-voler" },
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
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: `orphan.login.${stamp}@example.com`, password, localUserId: orphan.id }),
      }),
    );
    // Compte inexistant → 401 ; pas de fusion même avec un localUserId connu.
    assert.equal(attackerLogin.status, 401);

    const attacker = await registerAccount({
      email: `orphan.atk.${stamp}@example.com`,
      password,
      displayName: "Atk",
      localUserId: orphan.id,
    });
    cleanupIds.push(attacker.id);
    assert.equal(await prisma.collectionItem.findFirst({ where: { userId: attacker.id, notes: "a-voler" } }), null);
    assert.ok(await prisma.user.findUnique({ where: { id: orphan.id } }));

    const regWithLocal = await register(
      new Request("http://127.0.0.1/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
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
    assert.equal(await prisma.collectionItem.findFirst({ where: { userId: regBody.user.id, notes: "a-voler" } }), null);
  });
});

describe("limites", () => {
  it("l'ajout groupé refuse tôt un lot trop gros", async () => {
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
  });

  it("la connexion finit en 429 sous rafale", async () => {
    const email = `rate.${stamp}@example.com`;
    const user = await registerAccount({ email, password, displayName: "Rate", localUserId: null });
    cleanupIds.push(user.id);

    // IP fictives propres à cette exécution : compteurs neufs, sans toucher aux autres.
    const attackerIp = `203.0.113.1-${stamp}`;
    const otherIp = `198.51.100.7-${stamp}`;
    const attempt = (ip: string, pass: string) =>
      login(
        new Request("http://127.0.0.1/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": `${ip}, 10.0.0.1` },
          body: JSON.stringify({ email, password: pass }),
        }),
      );
    const previousTrust = process.env.TRUST_PROXY;
    process.env.TRUST_PROXY = "1";
    try {
      let hit429 = false;
      for (let i = 0; i < 25; i += 1) {
        if ((await attempt(attackerIp, "mauvais-mot-de-passe")).status === 429) {
          hit429 = true;
          break;
        }
      }
      assert.equal(hit429, true, "le login doit finir en 429 sous rafale");
      // Un autre visiteur ne doit pas être bloqué par les échecs du premier.
      assert.equal((await attempt(otherIp, password)).status, 200, "une autre IP ne doit pas être bloquée");
      const probeKey = clientKey(new Request("http://x/", { headers: { "x-forwarded-for": otherIp } }), "probe");
      assert.equal(probeKey, `probe:${otherIp}`);
      assert.equal((await rateLimit(probeKey, 1, 1000)).ok, true);
      assert.equal((await rateLimit(probeKey, 1, 1000)).ok, false);
    } finally {
      if (previousTrust === undefined) delete process.env.TRUST_PROXY;
      else process.env.TRUST_PROXY = previousTrust;
    }
  });
});
