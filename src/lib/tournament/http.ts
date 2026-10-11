// Réponses HTTP communes aux routes de tournoi.

import { NextResponse } from "next/server";
import { reportError } from "@/lib/monitoring";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { TournamentError } from "./errors";

/** Refus métier → message et statut ; toute autre erreur → 500 signalée. */
export async function errorResponse(source: string, error: unknown) {
  if (error instanceof TournamentError) {
    return NextResponse.json(
      { error: error.message, ...(error.details !== undefined ? { details: error.details } : {}) },
      { status: error.status },
    );
  }
  await reportError(source, error);
  return NextResponse.json({ error: "Erreur serveur, réessayez." }, { status: 500 });
}

export function sessionRequired() {
  return NextResponse.json({ error: "Session requise." }, { status: 401 });
}

/** 20 essais par minute et par IP : saisie de code, inscription, récupération de profil. */
export async function limitCodeAttempts(request: Request, scope: string) {
  const limited = await rateLimit(clientKey(request, scope), 20, 60_000);
  if (limited.ok) return null;
  return NextResponse.json(
    { error: "Trop de tentatives. Réessayez dans une minute." },
    { status: 429, headers: { "retry-after": String(Math.ceil(limited.retryAfterMs / 1000) || 60) } },
  );
}
