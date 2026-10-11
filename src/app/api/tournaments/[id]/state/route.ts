import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { viewerFromRequest } from "@/lib/tournament/player-auth";
import { loadTournament, tournamentRevision } from "@/lib/tournament/repository";
import { buildView } from "@/lib/tournament/view";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/**
 * Sondage des écrans : `?rev=N` répond `{ unchanged: true }` (une seule colonne lue) tant que
 * la révision n'a pas bougé, sinon la vue complète. `serverNow` corrige l'horloge du chrono.
 */
export async function GET(request: Request, context: Context) {
  const { id } = await context.params;
  const rev = new URL(request.url).searchParams.get("rev");
  // Sans `rev` (premier chargement), toujours la vue complète : Number(null) vaudrait 0.
  const known = rev === null || rev === "" ? null : Number(rev);
  const headers = { "cache-control": "no-store" };
  if (known !== null && Number.isInteger(known) && known >= 0) {
    const revision = await tournamentRevision(id);
    if (revision === null) return NextResponse.json({ error: "Tournoi introuvable." }, { status: 404, headers });
    if (revision === known) {
      return NextResponse.json({ unchanged: true, revision, serverNow: new Date().toISOString() }, { headers });
    }
  }
  const tournament = await loadTournament(prisma, id);
  if (!tournament) return NextResponse.json({ error: "Tournoi introuvable." }, { status: 404, headers });
  return NextResponse.json(buildView(tournament, await viewerFromRequest(request, id)), { headers });
}
