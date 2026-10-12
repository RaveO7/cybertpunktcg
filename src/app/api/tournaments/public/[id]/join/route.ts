import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { limitCodeAttempts } from "@/lib/tournament/http";
import { joinResponse } from "@/lib/tournament/join-http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * Inscription sans code depuis la fiche d'un tournoi public : mêmes règles que par code. La
 * réponse donne le code, pour rejoindre la vue joueur (/t/[code]).
 */
export async function POST(request: Request, context: Context) {
  const limited = await limitCodeAttempts(request, "tournament-public-join");
  if (limited) return limited;
  const { id } = await context.params;
  const row = await prisma.tournament.findUnique({ where: { id }, select: { id: true, code: true, visibility: true } });
  if (!row || row.visibility !== "public") return NextResponse.json({ error: "Tournoi introuvable." }, { status: 404 });
  return joinResponse(request, row.id, { code: row.code });
}
