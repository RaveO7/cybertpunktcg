import { NextResponse } from "next/server";
import { absoluteAppUrl } from "@/lib/app-url";
import { tournamentIcs } from "@/lib/tournament/calendar";
import { findPublicTournament } from "@/lib/tournament/directory";
import { formatRoute } from "@/i18n/match";
import { apiError, requestLocale } from "@/lib/api-response";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** Fichier iCalendar du tournoi (« Ajouter à mon agenda »). */
export async function GET(request: Request, context: Context) {
  const t = await findPublicTournament((await context.params).id);
  if (!t || !t.startsAt) return apiError(request, "tournaments.notFound", 404);
  const location = [t.venueName, t.address, [t.postalCode, t.city].filter(Boolean).join(" "), t.country]
    .filter(Boolean)
    .join(", ");
  const ics = tournamentIcs({
    id: t.id,
    name: t.name,
    startsAt: t.startsAt,
    swissRounds: t.swissRounds,
    roundMinutes: t.roundMinutes,
    location: location || null,
    url: absoluteAppUrl(request, formatRoute("/tournois/publics/[id]", requestLocale(request), { id: t.id })),
    description: t.description,
  });
  return new NextResponse(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="tournoi-${t.id}.ics"`,
    },
  });
}
