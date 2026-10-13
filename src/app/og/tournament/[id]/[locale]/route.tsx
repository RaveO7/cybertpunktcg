import { formatFee, formatStart } from "@/components/public/format";
import { COPY } from "@/lib/seo/copy";
import { isSiteLocale, ogImage } from "@/lib/seo/og-image";
import { findPublicTournament } from "@/lib/tournament/directory";
import { buildPublicView } from "@/lib/tournament/public-view";

/** Image de partage d'un tournoi public : nom, date, ville, boutique et prix. */
export async function GET(_request: Request, { params }: RouteContext<"/og/tournament/[id]/[locale]">) {
  const { id, locale } = await params;
  if (!isSiteLocale(locale)) return new Response("Not found", { status: 404 });
  const t = await findPublicTournament(id);
  if (!t) return new Response("Not found", { status: 404 });
  const view = buildPublicView(t);
  const copy = COPY[locale].og;
  const when = formatStart(view.startsAt, view.timeZone, locale, "long");
  const where = [view.venueName, view.city].filter(Boolean).join(", ");
  const fee = formatFee(view.entryFeeCents, view.currency, locale, copy.free);
  return ogImage({
    eyebrow: copy.tournament,
    title: view.name,
    lines: [when, [where, view.shop?.name && view.shop.name !== view.venueName ? view.shop.name : null].filter(Boolean).join(" · "), fee].filter(Boolean),
  });
}
