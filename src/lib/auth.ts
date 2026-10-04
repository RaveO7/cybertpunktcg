import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import type { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dummyPasswordHash, hashPassword, verifyPassword } from "@/lib/password";
import type { AuthUser } from "@/lib/types";

export const SESSION_COOKIE = "cptcg_session";

/** 400 jours : plafond courant des navigateurs. Prolongé à chaque ouverture. */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;
type AccountUser = {
  id: string;
  email: string | null;
  displayName: string;
  passwordHash: string | null;
};

export function toPublicUser(user: { id: string; email: string | null; displayName: string }): AuthUser {
  return {
    id: user.id,
    email: user.email ?? "",
    displayName: user.displayName,
  };
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export function normalizePassword(value: unknown) {
  if (typeof value !== "string") return null;
  if (value.length < 8 || value.length > 128) return null;
  return value;
}

// Connexion : pas de longueur minimale, le hash décide (seule l'inscription impose 8 caractères).
export function normalizeLoginPassword(value: unknown) {
  if (typeof value !== "string") return null;
  if (value.length < 1 || value.length > 128) return null;
  return value;
}

export function normalizeDisplayName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 40) return null;
  return name;
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function readSessionToken(request: Request) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    if (trimmed.slice(0, separator) !== SESSION_COOKIE) continue;
    try {
      return decodeURIComponent(trimmed.slice(separator + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function cookieSecure(request: Request) {
  const configured = process.env.APP_URL?.trim();
  if (configured) return configured.startsWith("https:");
  if (process.env.TRUST_PROXY === "1") {
    const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (forwarded) return forwarded === "https";
  }
  return new URL(request.url).protocol === "https:";
}

function sessionCookie(request: Request, token: string, expiresAt: Date, maxAge: number) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookieSecure(request),
    path: "/",
    maxAge,
    expires: expiresAt,
    priority: "high" as const,
  };
}

export function applySessionCookie(response: NextResponse, request: Request, token: string, expiresAt: Date) {
  response.cookies.set(sessionCookie(request, token, expiresAt, SESSION_MAX_AGE_SECONDS));
}

export function clearSessionCookie(response: NextResponse, request: Request) {
  response.cookies.set(sessionCookie(request, "", new Date(0), 0));
}

async function findAccount(token: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  // Compte = e-mail + (mot de passe ou identité OAuth). Les anonymes n'ont ni l'un ni l'autre.
  if (!session.user.email) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  if (session.user.passwordHash) return session;
  const oauth = await prisma.oAuthAccount.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!oauth) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return session;
}

export async function userFromRequest(request: Request) {
  const token = readSessionToken(request);
  if (!token) return null;
  const session = await findAccount(token);
  return session?.user ?? null;
}

export async function refreshSession(request: Request) {
  const token = readSessionToken(request);
  if (!token) return null;
  const session = await findAccount(token);
  if (!session) return null;
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await prisma.session.update({ where: { id: session.id }, data: { expiresAt } });
  return { user: session.user, token, expiresAt };
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } });
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt },
  });
  return { token, expiresAt };
}

export async function revokeSession(request: Request) {
  const token = readSessionToken(request);
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function registerAccount(input: {
  email: string;
  password: string;
  displayName: string | null;
  localUserId?: string | null;
}): Promise<AccountUser> {
  void input.localUserId;
  const passwordHash = await hashPassword(input.password);
  try {
    const result = await prisma.$transaction(async (tx) => {
      const taken = await tx.user.findUnique({ where: { email: input.email } });
      if (taken) return null;
      return tx.user.create({
        data: {
          email: input.email,
          passwordHash,
          displayName: input.displayName ?? "Ma collection",
        },
      });
    });
    if (!result) throw new Error("EMAIL_TAKEN");
    return result;
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_TAKEN") throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error("EMAIL_TAKEN");
    }
    throw error;
  }
}

export async function authenticate(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  const stored = user?.passwordHash;
  const ok = await verifyPassword(password, stored ?? (await dummyPasswordHash()));
  if (!user?.passwordHash || !user.email || !ok) return null;
  // Ancien hash scrypt : on le remplace par le mot de passe en clair à la première connexion.
  if (user.passwordHash !== password) {
    const passwordHash = await hashPassword(password);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    return { ...user, passwordHash };
  }
  return user;
}
