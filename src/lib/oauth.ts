import { createHmac, createPrivateKey, randomBytes, sign, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { normalizeDisplayName, normalizeEmail } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const OAUTH_PROVIDERS = ["google", "apple"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

const USER_ID = /^[a-zA-Z0-9_-]{8,64}$/;

type OAuthProfile = {
  provider: OAuthProvider;
  providerUserId: string;
  email: string | null;
  displayName: string | null;
};

export type VerifiedOAuthState = {
  provider: OAuthProvider;
  localUserId: string | null;
};

export function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

export function oauthConfigured(provider: OAuthProvider) {
  if (provider === "google") {
    return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
  }
  return Boolean(
    process.env.APPLE_CLIENT_ID?.trim() &&
      process.env.APPLE_TEAM_ID?.trim() &&
      process.env.APPLE_KEY_ID?.trim() &&
      process.env.APPLE_PRIVATE_KEY?.trim(),
  );
}

export function listConfiguredOAuthProviders() {
  return OAUTH_PROVIDERS.filter(oauthConfigured);
}

export function appOrigin(request: Request) {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.TRUST_PROXY === "1") {
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (forwardedHost) {
      return `${forwardedProto === "http" ? "http" : "https"}://${forwardedHost}`;
    }
  }
  return new URL(request.url).origin;
}

function stateSecret() {
  const secret =
    process.env.OAUTH_STATE_SECRET?.trim() ||
    process.env.GOOGLE_CLIENT_SECRET?.trim() ||
    process.env.APPLE_CLIENT_ID?.trim() ||
    "";
  if (!secret || secret.length < 16) {
    throw new Error("OAUTH_STATE_SECRET_MISSING");
  }
  return secret;
}

function signStateBody(body: string) {
  return createHmac("sha256", stateSecret()).update(body).digest("base64url");
}

/** State OAuth signé (pas de cookie) : compatible avec le form_post Apple cross-site. */
export function createOAuthState(provider: OAuthProvider, localUserId: string | null) {
  const payload = {
    n: randomBytes(16).toString("base64url"),
    p: provider,
    l: localUserId && USER_ID.test(localUserId) ? localUserId : null,
    e: Date.now() + 10 * 60 * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signStateBody(body)}`;
}

export function verifyOAuthState(raw: string | null, expectedProvider: OAuthProvider): VerifiedOAuthState | null {
  if (!raw) return null;
  const separator = raw.lastIndexOf(".");
  if (separator <= 0) return null;
  const body = raw.slice(0, separator);
  const signature = raw.slice(separator + 1);
  let expected: string;
  try {
    expected = signStateBody(body);
  } catch {
    return null;
  }
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      p?: string;
      l?: string | null;
      e?: number;
    };
    if (!isOAuthProvider(String(parsed.p)) || parsed.p !== expectedProvider) return null;
    if (typeof parsed.e !== "number" || parsed.e <= Date.now()) return null;
    return {
      provider: parsed.p,
      localUserId: typeof parsed.l === "string" && USER_ID.test(parsed.l) ? parsed.l : null,
    };
  } catch {
    return null;
  }
}

function callbackUrl(origin: string, provider: OAuthProvider) {
  return `${origin}/api/auth/oauth/${provider}/callback`;
}

function base64urlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function applePrivateKey() {
  const raw = process.env.APPLE_PRIVATE_KEY?.trim() ?? "";
  const pem = raw.includes("BEGIN") ? raw.replace(/\\n/g, "\n") : raw;
  return createPrivateKey(pem);
}

function appleClientSecret() {
  const clientId = process.env.APPLE_CLIENT_ID!.trim();
  const teamId = process.env.APPLE_TEAM_ID!.trim();
  const keyId = process.env.APPLE_KEY_ID!.trim();
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlJson({ alg: "ES256", kid: keyId });
  const payload = base64urlJson({
    iss: teamId,
    iat: now,
    exp: now + 60 * 20,
    aud: "https://appleid.apple.com",
    sub: clientId,
  });
  const data = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(data), {
    key: applePrivateKey(),
    dsaEncoding: "ieee-p1363",
  });
  return `${data}.${signature.toString("base64url")}`;
}

function decodeJwtPayload(token: string) {
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function buildAuthorizationUrl(provider: OAuthProvider, request: Request, state: string) {
  const origin = appOrigin(request);
  const redirectUri = callbackUrl(origin, provider);
  if (provider === "google") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!.trim());
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("prompt", "select_account");
    return url;
  }
  const url = new URL("https://appleid.apple.com/auth/authorize");
  url.searchParams.set("client_id", process.env.APPLE_CLIENT_ID!.trim());
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "form_post");
  url.searchParams.set("scope", "name email");
  url.searchParams.set("state", state);
  return url;
}

async function exchangeGoogle(code: string, request: Request): Promise<OAuthProfile> {
  const origin = appOrigin(request);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_CLIENT_SECRET!.trim(),
      redirect_uri: callbackUrl(origin, "google"),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) throw new Error("OAUTH_TOKEN");
  const tokenJson = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenJson.access_token) throw new Error("OAUTH_TOKEN");

  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!profileResponse.ok) throw new Error("OAUTH_PROFILE");
  const profile = (await profileResponse.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  if (!profile.sub) throw new Error("OAUTH_PROFILE");
  const email =
    profile.email_verified === false ? null : normalizeEmail(typeof profile.email === "string" ? profile.email : null);
  return {
    provider: "google",
    providerUserId: profile.sub,
    email,
    displayName: normalizeDisplayName(typeof profile.name === "string" ? profile.name : null),
  };
}

async function exchangeApple(code: string, request: Request, rawUser: string | null): Promise<OAuthProfile> {
  const origin = appOrigin(request);
  const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.APPLE_CLIENT_ID!.trim(),
      client_secret: appleClientSecret(),
      redirect_uri: callbackUrl(origin, "apple"),
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) throw new Error("OAUTH_TOKEN");
  const tokenJson = (await tokenResponse.json()) as { id_token?: string };
  if (!tokenJson.id_token) throw new Error("OAUTH_TOKEN");
  const claims = decodeJwtPayload(tokenJson.id_token);
  if (!claims || typeof claims.sub !== "string") throw new Error("OAUTH_PROFILE");
  const clientId = process.env.APPLE_CLIENT_ID!.trim();
  if (claims.iss !== "https://appleid.apple.com") throw new Error("OAUTH_PROFILE");
  const aud = claims.aud;
  const audOk = aud === clientId || (Array.isArray(aud) && aud.includes(clientId));
  if (!audOk) throw new Error("OAUTH_PROFILE");
  if (typeof claims.exp === "number" && claims.exp * 1000 <= Date.now()) throw new Error("OAUTH_PROFILE");

  let displayName: string | null = null;
  if (rawUser) {
    try {
      const parsed = JSON.parse(rawUser) as { name?: { firstName?: string; lastName?: string } };
      const full = [parsed.name?.firstName, parsed.name?.lastName].filter(Boolean).join(" ");
      displayName = normalizeDisplayName(full || null);
    } catch {
      displayName = null;
    }
  }

  const email =
    claims.email_verified === "false" || claims.email_verified === false
      ? null
      : normalizeEmail(typeof claims.email === "string" ? claims.email : null);

  return {
    provider: "apple",
    providerUserId: claims.sub,
    email,
    displayName,
  };
}

export async function exchangeOAuthCode(
  provider: OAuthProvider,
  code: string,
  request: Request,
  appleUserJson: string | null = null,
) {
  if (provider === "google") return exchangeGoogle(code, request);
  return exchangeApple(code, request, appleUserJson);
}

export async function loginWithOAuth(profile: OAuthProfile, localUserId: string | null) {
  void localUserId;
  const existingLink = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerUserId: {
        provider: profile.provider,
        providerUserId: profile.providerUserId,
      },
    },
    include: { user: true },
  });
  if (existingLink) {
    if (profile.email && !existingLink.user.email) {
      try {
        await prisma.user.update({
          where: { id: existingLink.user.id },
          data: { email: profile.email },
        });
        existingLink.user.email = profile.email;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) throw error;
      }
    }
    return existingLink.user;
  }

  if (!profile.email) {
    throw new Error("OAUTH_EMAIL_REQUIRED");
  }

  const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (byEmail) {
    // Pas de liaison silencieuse : un compte password pré-enregistré avec le même e-mail
    // ne doit pas être pris via OAuth sans preuve (prise de contrôle).
    throw new Error("ACCOUNT_EXISTS");
  }

  const displayName = profile.displayName ?? "Ma collection";

  try {
    return await prisma.user.create({
      data: {
        email: profile.email,
        displayName,
        oauthAccounts: {
          create: {
            provider: profile.provider,
            providerUserId: profile.providerUserId,
          },
        },
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("EMAIL_TAKEN");
    }
    throw error;
  }
}

export function oauthErrorRedirect(origin: string, message: string) {
  const url = new URL("/", origin);
  url.searchParams.set("authError", message);
  return url;
}
