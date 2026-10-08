/**
 * Connexion OAuth (Google, Apple) : démarrage, state signé, callback.
 * Aucune requête réseau réelle : `fetch` est remplacé par un faux fournisseur.
 */
import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from "vitest";
import { GET as providersRoute } from "../../src/app/api/auth/oauth/route";
import { GET as startRoute } from "../../src/app/api/auth/oauth/[provider]/route";
import {
  GET as callbackGet,
  POST as callbackPost,
} from "../../src/app/api/auth/oauth/[provider]/callback/route";
import { SESSION_COOKIE, registerAccount } from "../../src/lib/auth";
import { createOAuthState, verifyOAuthState } from "../../src/lib/oauth";
import { prisma } from "../../src/lib/prisma";

const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const STATE_SECRET = `secret-de-test-${stamp}-0123456789`;
const GOOGLE_ID = `google-client-${stamp}`;
const APPLE_ID = `com.example.classeur.${stamp}`;
const createdUserIds: string[] = [];

const ENV_KEYS = [
  "OAUTH_STATE_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "APPLE_CLIENT_ID",
  "APPLE_TEAM_ID",
  "APPLE_KEY_ID",
  "APPLE_PRIVATE_KEY",
  "APP_URL",
  "TRUST_PROXY",
] as const;
const savedEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function setEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

const ORIGIN = "https://classeur.example.com";
const applePem = generateKeyPairSync("ec", { namedCurve: "P-256" })
  .privateKey.export({ type: "pkcs8", format: "pem" })
  .toString();

function configureAll() {
  setEnv({
    OAUTH_STATE_SECRET: STATE_SECRET,
    GOOGLE_CLIENT_ID: GOOGLE_ID,
    GOOGLE_CLIENT_SECRET: `google-secret-${stamp}`,
    APPLE_CLIENT_ID: APPLE_ID,
    APPLE_TEAM_ID: "TEAMID1234",
    APPLE_KEY_ID: "KEYID12345",
    APPLE_PRIVATE_KEY: applePem,
    APP_URL: ORIGIN,
    TRUST_PROXY: undefined,
  });
}

/** Faux fournisseur : chaque test décrit les réponses ; toute autre URL fait échouer le test. */
type FakeReply = { status?: number; body: unknown };
let replies: Record<string, FakeReply | ((init?: RequestInit) => FakeReply)> = {};
const fetchCalls: { url: string; init?: RequestInit }[] = [];
const fakeFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  fetchCalls.push({ url, init });
  const reply = replies[url];
  if (!reply) throw new Error(`requête réseau inattendue: ${url}`);
  const { status = 200, body } = typeof reply === "function" ? reply(init) : reply;
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
});

const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";
const APPLE_TOKEN = "https://appleid.apple.com/auth/token";

function googleProfile(profile: Record<string, unknown>) {
  replies = {
    [GOOGLE_TOKEN]: { body: { access_token: `access-${stamp}` } },
    [GOOGLE_USERINFO]: { body: profile },
  };
}

function fakeJwt(claims: Record<string, unknown>) {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(claims)}.signature`;
}

function appleClaims(claims: Record<string, unknown>) {
  replies = { [APPLE_TOKEN]: { body: { id_token: fakeJwt(claims) } } };
}

function signedState(payload: Record<string, unknown>, secret = STATE_SECRET) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${createHmac("sha256", secret).update(body).digest("base64url")}`;
}

function context(provider: string) {
  return { params: Promise.resolve({ provider }) };
}

function callback(provider: string, params: Record<string, string>) {
  const url = new URL(`http://127.0.0.1/api/auth/oauth/${provider}/callback`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return callbackGet(new Request(url), context(provider));
}

function applePost(params: Record<string, string>, provider = "apple") {
  const form = new FormData();
  for (const [key, value] of Object.entries(params)) form.set(key, value);
  return callbackPost(
    new Request(`http://127.0.0.1/api/auth/oauth/${provider}/callback`, { method: "POST", body: form }),
    context(provider),
  );
}

function location(response: Response) {
  const raw = response.headers.get("location");
  assert.ok(raw, `redirection attendue (statut ${response.status})`);
  return new URL(raw);
}

/** Échec : retour à l'accueil avec un message, sans cookie de session. */
function expectFailure(response: Response, message: RegExp) {
  assert.ok([302, 303, 307].includes(response.status), `redirection attendue, reçu ${response.status}`);
  const target = location(response);
  assert.equal(target.origin, ORIGIN);
  assert.equal(target.pathname, "/");
  assert.match(target.searchParams.get("authError") ?? "", message);
  assert.equal(
    response.headers.getSetCookie().some((line) => line.startsWith(`${SESSION_COOKIE}=`) && !/Max-Age=0/i.test(line)),
    false,
    "aucune session ouverte",
  );
}

/** Succès : retour à l'accueil connecté. Renvoie l'utilisateur de la nouvelle session. */
async function expectSuccess(response: Response) {
  assert.ok([302, 303, 307].includes(response.status), `redirection attendue, reçu ${response.status}`);
  const target = location(response);
  assert.equal(target.toString(), `${ORIGIN}/`, `échec inattendu : ${target.searchParams.get("authError")}`);
  const line = response.headers.getSetCookie().find((item) => item.startsWith(`${SESSION_COOKIE}=`));
  assert.ok(line, "cookie de session posé");
  assert.match(line, /HttpOnly/i);
  assert.match(line, /Secure/i, "APP_URL en https : cookie Secure");
  const token = decodeURIComponent(line.split(";")[0].slice(SESSION_COOKIE.length + 1));
  const { createHash } = await import("node:crypto");
  const session = await prisma.session.findUnique({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    include: { user: true },
  });
  assert.ok(session, "session enregistrée");
  if (!createdUserIds.includes(session.userId)) createdUserIds.push(session.userId);
  return session.user;
}

beforeAll(() => {
  vi.stubGlobal("fetch", fakeFetch);
});

beforeEach(() => {
  configureAll();
  replies = {};
  fetchCalls.length = 0;
});

afterEach(() => {
  setEnv(savedEnv);
});

afterAll(async () => {
  vi.unstubAllGlobals();
  setEnv(savedEnv);
  // Comptes créés par OAuth : tous portent le marqueur de cette exécution.
  const marked = await prisma.user.findMany({ where: { email: { contains: stamp } }, select: { id: true } });
  const ids = [...new Set([...createdUserIds, ...marked.map((user) => user.id)])];
  if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

describe("fournisseurs disponibles", () => {
  it("liste seulement les fournisseurs entièrement configurés", async () => {
    assert.deepEqual(await (await providersRoute()).json(), { google: true, apple: true });
    setEnv({ GOOGLE_CLIENT_SECRET: "  ", APPLE_KEY_ID: undefined });
    assert.deepEqual(await (await providersRoute()).json(), { google: false, apple: false });
  });
});

describe("démarrage de la connexion", () => {
  it("fournisseur inconnu → 404, non configuré → 503", async () => {
    for (const provider of ["github", "GOOGLE", "", "__proto__"]) {
      const response = await startRoute(new Request("http://127.0.0.1/api/auth/oauth/x"), context(provider));
      assert.equal(response.status, 404, `fournisseur « ${provider} »`);
    }
    setEnv({ GOOGLE_CLIENT_ID: undefined });
    const response = await startRoute(new Request("http://127.0.0.1/api/auth/oauth/google"), context("google"));
    assert.equal(response.status, 503);
  });

  it("sans secret de state suffisant → 503", async () => {
    setEnv({ OAUTH_STATE_SECRET: undefined, GOOGLE_CLIENT_SECRET: "court", APPLE_CLIENT_ID: undefined });
    const response = await startRoute(new Request("http://127.0.0.1/api/auth/oauth/google"), context("google"));
    assert.equal(response.status, 503);
    assert.match(((await response.json()) as { error: string }).error, /secret/i);
  });

  it("Google : redirection vers le fournisseur avec un state vérifiable", async () => {
    const response = await startRoute(
      new Request("http://127.0.0.1/api/auth/oauth/google?localUserId=abcdefgh1234"),
      context("google"),
    );
    const target = location(response);
    assert.equal(target.origin + target.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
    assert.equal(target.searchParams.get("client_id"), GOOGLE_ID);
    assert.equal(target.searchParams.get("redirect_uri"), `${ORIGIN}/api/auth/oauth/google/callback`);
    assert.equal(target.searchParams.get("response_type"), "code");
    const state = target.searchParams.get("state");
    assert.ok(state);
    assert.deepEqual(verifyOAuthState(state, "google"), { provider: "google", localUserId: "abcdefgh1234" });
    assert.equal(verifyOAuthState(state, "apple"), null, "un state Google n'est pas valable pour Apple");
    assert.equal(fetchCalls.length, 0, "aucun appel réseau au démarrage");
  });

  it("Apple : form_post ; localUserId invalide écarté du state", async () => {
    const response = await startRoute(
      new Request("http://127.0.0.1/api/auth/oauth/apple?localUserId=%3Cscript%3E"),
      context("apple"),
    );
    const target = location(response);
    assert.equal(target.origin, "https://appleid.apple.com");
    assert.equal(target.searchParams.get("response_mode"), "form_post");
    assert.equal(target.searchParams.get("client_id"), APPLE_ID);
    assert.deepEqual(verifyOAuthState(target.searchParams.get("state"), "apple"), {
      provider: "apple",
      localUserId: null,
    });
  });

  it("le redirect_uri ignore un x-forwarded-host non approuvé", async () => {
    setEnv({ APP_URL: undefined });
    const response = await startRoute(
      new Request("http://127.0.0.1:3000/api/auth/oauth/google", { headers: { "x-forwarded-host": "evil.example" } }),
      context("google"),
    );
    assert.equal(
      location(response).searchParams.get("redirect_uri"),
      "http://127.0.0.1:3000/api/auth/oauth/google/callback",
    );
  });
});

describe("vérification du state", () => {
  it("refuse state absent, mal formé, falsifié, expiré ou d'un autre fournisseur", () => {
    const valid = createOAuthState("google", null);
    const [body, signature] = valid.split(".");
    const future = Date.now() + 60_000;
    const cases: [string, string | null][] = [
      ["absent", null],
      ["vide", ""],
      ["sans signature", body],
      ["point initial", `.${signature}`],
      ["signature modifiée", `${body}.${signature.slice(0, -2)}AA`],
      ["signature tronquée", `${body}.${signature.slice(0, 10)}`],
      ["corps modifié", `${Buffer.from(JSON.stringify({ n: "x", p: "google", l: null, e: future + 1 })).toString("base64url")}.${signature}`],
      ["autre secret", signedState({ n: "x", p: "google", l: null, e: future }, "un-autre-secret-assez-long")],
      ["expiré", signedState({ n: "x", p: "google", l: null, e: Date.now() - 1 })],
      ["sans expiration", signedState({ n: "x", p: "google", l: null })],
      ["expiration texte", signedState({ n: "x", p: "google", l: null, e: String(future) })],
      ["autre fournisseur", signedState({ n: "x", p: "apple", l: null, e: future })],
      ["fournisseur inconnu", signedState({ n: "x", p: "github", l: null, e: future })],
      ["corps non JSON", `${Buffer.from("pas du json").toString("base64url")}.${createHmac("sha256", STATE_SECRET).update(Buffer.from("pas du json").toString("base64url")).digest("base64url")}`],
    ];
    for (const [label, state] of cases) {
      assert.equal(verifyOAuthState(state, "google"), null, `state ${label}`);
    }
    assert.ok(verifyOAuthState(valid, "google"), "le state d'origine reste valide");
    assert.deepEqual(
      verifyOAuthState(signedState({ n: "x", p: "google", l: "../../etc", e: future }), "google"),
      { provider: "google", localUserId: null },
      "localUserId invalide ignoré même signé",
    );
  });
});

describe.sequential("callback", () => {
  it("fournisseur inconnu ou non configuré : retour à l'accueil avec une erreur", async () => {
    expectFailure(await callback("github", { code: "c", state: "s" }), /inconnu/i);
    setEnv({ APPLE_PRIVATE_KEY: undefined });
    expectFailure(await callback("apple", { code: "c", state: createOAuthState("apple", null) }), /non configurée/i);
    assert.equal(fetchCalls.length, 0);
  });

  it("annulation, code ou state manquant, state invalide : aucun appel au fournisseur", async () => {
    const state = createOAuthState("google", null);
    expectFailure(await callback("google", { error: "access_denied", code: "c", state }), /annulée/i);
    expectFailure(await callback("google", { state }), /invalide/i);
    expectFailure(await callback("google", { code: "c" }), /invalide/i);
    expectFailure(await callback("google", { code: "c", state: "falsifie.signature" }), /expirée/i);
    expectFailure(
      await callback("google", { code: "c", state: signedState({ n: "x", p: "google", l: null, e: Date.now() - 1000 }) }),
      /expirée/i,
    );
    expectFailure(await callback("google", { code: "c", state: createOAuthState("apple", null) }), /expirée/i);
    assert.equal(fetchCalls.length, 0, "aucun échange de code sans state valide");
  });

  it("POST sans formulaire : refusé", async () => {
    const response = await callbackPost(
      new Request("http://127.0.0.1/api/auth/oauth/apple/callback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
      context("apple"),
    );
    expectFailure(response, /annulée/i);
  });

  it("Google : crée le compte, ouvre la session, puis retrouve le même compte", async () => {
    const email = `oauth.google.${stamp}@example.com`;
    googleProfile({ sub: `google-${stamp}`, email: email.toUpperCase(), email_verified: true, name: "Joueur Google" });
    const user = await expectSuccess(await callback("google", { code: "code-1", state: createOAuthState("google", null) }));
    assert.equal(user.email, email, "e-mail normalisé");
    assert.equal(user.displayName, "Joueur Google");
    assert.equal(user.passwordHash, null);
    const link = await prisma.oAuthAccount.findFirst({ where: { userId: user.id } });
    assert.equal(link?.provider, "google");
    assert.equal(link?.providerUserId, `google-${stamp}`);

    const tokenCall = fetchCalls.find((call) => call.url === GOOGLE_TOKEN);
    const sent = new URLSearchParams(String(tokenCall?.init?.body));
    assert.equal(sent.get("code"), "code-1");
    assert.equal(sent.get("redirect_uri"), `${ORIGIN}/api/auth/oauth/google/callback`);
    assert.equal(sent.get("grant_type"), "authorization_code");

    googleProfile({ sub: `google-${stamp}`, email, email_verified: true, name: "Autre nom" });
    const again = await expectSuccess(await callback("google", { code: "code-2", state: createOAuthState("google", null) }));
    assert.equal(again.id, user.id, "même identité Google = même compte");
    assert.equal(await prisma.oAuthAccount.count({ where: { userId: user.id } }), 1);
  });

  // BUG (sécurité, moyenne) : le state est sans état côté serveur et n'est lié ni au navigateur
  // (pas de cookie) ni à un usage unique. Un même state reste valable 10 min pour n'importe quel
  // navigateur : rejouable, et il ne protège pas contre le « login CSRF » (un attaquant envoie à la
  // victime son propre lien de callback code+state et la connecte sur le compte de l'attaquant).
  // Attendu : un state déjà utilisé est refusé. Observé : le second callback ouvre une session.
  it.fails("BUG: un state déjà utilisé est refusé", async () => {
    const email = `oauth.replay.${stamp}@example.com`;
    const state = createOAuthState("google", null);
    googleProfile({ sub: `google-replay-${stamp}`, email, email_verified: true });
    await expectSuccess(await callback("google", { code: "code-a", state }));
    googleProfile({ sub: `google-replay-${stamp}`, email, email_verified: true });
    expectFailure(await callback("google", { code: "code-b", state }), /.+/);
  });

  it("Google : e-mail non vérifié, compte existant, erreurs du fournisseur", async () => {
    googleProfile({ sub: `google-unverified-${stamp}`, email: `oauth.nv.${stamp}@example.com`, email_verified: false });
    expectFailure(await callback("google", { code: "c", state: createOAuthState("google", null) }), /e-mail est requise/i);
    assert.equal(await prisma.user.count({ where: { email: `oauth.nv.${stamp}@example.com` } }), 0);

    const existingEmail = `oauth.existant.${stamp}@example.com`;
    const existing = await registerAccount({ email: existingEmail, password: "motdepasse-robuste", displayName: "Existant" });
    createdUserIds.push(existing.id);
    googleProfile({ sub: `google-thief-${stamp}`, email: existingEmail, email_verified: true });
    expectFailure(await callback("google", { code: "c", state: createOAuthState("google", null) }), /existe déjà/i);
    assert.equal(await prisma.oAuthAccount.count({ where: { userId: existing.id } }), 0, "aucune liaison silencieuse");

    replies = { [GOOGLE_TOKEN]: { status: 400, body: { error: "invalid_grant" } } };
    expectFailure(await callback("google", { code: "c", state: createOAuthState("google", null) }), /impossible/i);
    replies = { [GOOGLE_TOKEN]: { body: {} } };
    expectFailure(await callback("google", { code: "c", state: createOAuthState("google", null) }), /impossible/i);
    googleProfile({ email: `oauth.nosub.${stamp}@example.com` });
    expectFailure(await callback("google", { code: "c", state: createOAuthState("google", null) }), /impossible/i);
    replies = {
      [GOOGLE_TOKEN]: { body: { access_token: "a" } },
      [GOOGLE_USERINFO]: { status: 500, body: {} },
    };
    expectFailure(await callback("google", { code: "c", state: createOAuthState("google", null) }), /impossible/i);
  });

  it("Apple : form_post, nom du premier envoi, client_secret signé", async () => {
    const email = `oauth.apple.${stamp}@example.com`;
    appleClaims({
      iss: "https://appleid.apple.com",
      aud: APPLE_ID,
      sub: `apple-${stamp}`,
      email,
      email_verified: "true",
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    const user = await expectSuccess(
      await applePost({
        code: "apple-code",
        state: createOAuthState("apple", null),
        user: JSON.stringify({ name: { firstName: "Judy", lastName: "Alvarez" } }),
      }),
    );
    assert.equal(user.email, email);
    assert.equal(user.displayName, "Judy Alvarez");
    const sent = new URLSearchParams(String(fetchCalls[0]?.init?.body));
    assert.equal(sent.get("client_id"), APPLE_ID);
    const secret = sent.get("client_secret") ?? "";
    assert.equal(secret.split(".").length, 3, "client_secret au format JWT");
    const claims = JSON.parse(Buffer.from(secret.split(".")[1], "base64url").toString("utf8")) as Record<string, unknown>;
    assert.equal(claims.sub, APPLE_ID);
    assert.equal(claims.aud, "https://appleid.apple.com");
  });

  it("Apple : jeton d'un autre émetteur, d'une autre application ou expiré refusé", async () => {
    const base = {
      iss: "https://appleid.apple.com",
      aud: APPLE_ID,
      sub: `apple-bad-${stamp}`,
      email: `oauth.applebad.${stamp}@example.com`,
      exp: Math.floor(Date.now() / 1000) + 600,
    };
    for (const claims of [
      { ...base, iss: "https://evil.example" },
      { ...base, aud: "com.autre.application" },
      { ...base, exp: Math.floor(Date.now() / 1000) - 10 },
      { ...base, sub: undefined },
    ]) {
      appleClaims(claims);
      expectFailure(await applePost({ code: "c", state: createOAuthState("apple", null) }), /impossible/i);
    }
    appleClaims({ ...base, email_verified: "false" });
    expectFailure(await applePost({ code: "c", state: createOAuthState("apple", null) }), /e-mail est requise/i);
    replies = { [APPLE_TOKEN]: { body: { id_token: "pas-un-jwt" } } };
    expectFailure(await applePost({ code: "c", state: createOAuthState("apple", null) }), /impossible/i);
    assert.equal(await prisma.user.count({ where: { email: base.email } }), 0);
  });

  it("Apple : un state Google est refusé", async () => {
    expectFailure(await applePost({ code: "c", state: createOAuthState("google", null) }), /expirée/i);
    assert.equal(fetchCalls.length, 0);
  });
});
