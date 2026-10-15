// Identité d'un joueur de tournoi : son compte (sur n'importe quel appareil) ou le jeton de
// l'appareil lié, posé dans un cookie httpOnly propre au tournoi. Le QR personnel (usage
// unique, 15 min) relie un nouvel appareil au joueur et déconnecte l'ancien.

import type { NextResponse } from "next/server";
import { cookieSecure, userFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fail } from "./errors";
import { writeTournament, type FullTournament, type PlayerRow } from "./repository";
import { createToken, hashToken } from "./tokens";

export const PLAYER_COOKIE_PREFIX = "cptcg_tp_";
export const PLAYER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type Viewer = { userId: string | null; deviceTokenHash: string | null };

export function playerCookieName(tournamentId: string) {
  return `${PLAYER_COOKIE_PREFIX}${tournamentId}`;
}

function readCookie(request: Request, name: string) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator === -1 || trimmed.slice(0, separator) !== name) continue;
    try {
      return decodeURIComponent(trimmed.slice(separator + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/** Compte connecté et jeton d'appareil de ce tournoi, s'il y en a. */
export async function viewerFromRequest(request: Request, tournamentId: string): Promise<Viewer> {
  const user = await userFromRequest(request);
  const token = readCookie(request, playerCookieName(tournamentId));
  return { userId: user?.id ?? null, deviceTokenHash: token ? hashToken(token) : null };
}

/** Joueur correspondant à l'utilisateur : par compte d'abord, puis par appareil. */
export function findViewerPlayer(t: FullTournament, viewer: Viewer): PlayerRow | null {
  if (viewer.userId) {
    const byAccount = t.players.find((player) => player.userId === viewer.userId);
    if (byAccount) return byAccount;
  }
  if (viewer.deviceTokenHash) {
    return t.players.find((player) => player.deviceTokenHash === viewer.deviceTokenHash) ?? null;
  }
  return null;
}

export function setPlayerCookie(response: NextResponse, request: Request, tournamentId: string, token: string) {
  response.cookies.set({
    name: playerCookieName(tournamentId),
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(request),
    path: "/",
    maxAge: PLAYER_COOKIE_MAX_AGE_SECONDS,
  });
}

/** Nouveau jeton d'appareil (le jeton en clair ne quitte le serveur que dans le cookie). */
export function newDeviceToken() {
  const token = createToken();
  return { token, hash: hashToken(token) };
}

/**
 * Récupération d'un profil par QR personnel : lie cet appareil (et le compte connecté s'il
 * n'est pas déjà inscrit sous un autre pseudo) au joueur. Le QR ne sert qu'une fois.
 */
export async function claimPlayer(claimToken: string, userId: string | null, now = new Date()) {
  const target = await prisma.tournamentPlayer.findUnique({
    where: { claimTokenHash: hashToken(claimToken) },
    select: { id: true, tournamentId: true },
  });
  if (!target) fail("tournaments.invalidClaim", 404);
  return writeTournament(target.tournamentId, async (tx, t) => {
    const player = t.players.find((candidate) => candidate.id === target.id);
    if (!player || player.claimTokenHash !== hashToken(claimToken)) {
      fail("tournaments.invalidClaim", 404);
    }
    if (!player.claimExpiresAt || player.claimExpiresAt <= now) {
      fail("tournaments.expiredClaim", 410);
    }
    let linkUser = player.userId;
    if (userId && !player.userId) {
      const other = t.players.find((candidate) => candidate.userId === userId && candidate.id !== player.id);
      if (other) {
        fail("tournaments.accountAlreadyRegistered", 409, undefined, { name: other.name });
      }
      linkUser = userId;
    }
    const device = newDeviceToken();
    await tx.tournamentPlayer.update({
      where: { id: player.id },
      data: { deviceTokenHash: device.hash, claimTokenHash: null, claimExpiresAt: null, userId: linkUser },
    });
    return { tournamentId: t.id, code: t.code, playerId: player.id, deviceToken: device.token };
  });
}
