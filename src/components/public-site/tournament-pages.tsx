// Tournois publics : fiche dans chaque langue (/tournois/publics/[id], /en/tournaments/[id]…),
// annuaire affiché sur l'accueil des visiteurs et sur /tournois/publics pour les comptes connectés.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { apiParams, cleanParams } from "@/components/public/directory-params";
import { formatStart } from "@/components/public/format";
import { PublicDirectory } from "@/components/public/PublicDirectory";
import { PublicTournamentPage } from "@/components/public/PublicTournamentPage";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { JsonLd } from "@/components/site/JsonLd";
import { directoryQuerySchema, validateSearchParams } from "@/lib/api-schemas";
import { pageMetadata } from "@/lib/seo/metadata";
import { eventLd } from "@/lib/seo/structured-data";
import { directoryQueryFromParams, findPublicTournament, searchPublicTournaments } from "@/lib/tournament/directory";
import { buildPublicView } from "@/lib/tournament/public-view";
import type { Locale } from "@/i18n/config";
import { localizedPath } from "@/i18n/paths";
import { translatorFor } from "@/i18n/server";

// Métadonnées et page lisent le même tournoi : une seule requête par rendu.
const findTournament = cache(findPublicTournament);

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Premier rendu côté serveur de l'annuaire (paramètres d'URL nettoyés et validés). */
export async function initialTournamentDirectory(raw: Record<string, string | string[] | undefined>) {
  const params = cleanParams(raw);
  const parsed = validateSearchParams(directoryQuerySchema, apiParams(params, new Date()));
  const initial = parsed.ok ? await searchPublicTournaments(directoryQueryFromParams(parsed.data)) : null;
  return { params, initial };
}

/** Annuaire complet, réservé aux comptes connectés (les visiteurs le voient sur l'accueil). */
export async function TournamentsDirectory({ searchParams }: { searchParams: SearchParams }) {
  const { params, initial } = await initialTournamentDirectory(await searchParams);
  return <PublicDirectory initialParams={params} initial={initial} />;
}

export async function tournamentMetadata(locale: Locale, id: string): Promise<Metadata> {
  const [tournament, t] = await Promise.all([findTournament(id), translatorFor(locale, "publicTournaments")]);
  if (!tournament) return { title: t("seo.crumb"), robots: { index: false, follow: false } };
  const view = buildPublicView(tournament);
  const when = view.startsAt ? formatStart(view.startsAt, view.timeZone, locale, "long") : null;
  const where = [view.venueName, view.city].filter(Boolean).join(", ");
  const parts = [when, where, view.shop?.name ?? null].filter((part): part is string => Boolean(part));
  return pageMetadata({
    locale,
    page: { key: "tournament", params: { id } },
    title: t("seo.itemTitle", { name: view.name }),
    description: t("seo.itemDescription", { details: parts.join(" · ") }),
    image: { url: `/og/tournament/${encodeURIComponent(id)}/${locale}`, width: 1200, height: 630, alt: view.name },
    // Tournoi annulé : la fiche reste consultable mais n'est plus indexée.
    noindex: view.status === "annule",
  });
}

export async function TournamentDetail({ locale, id }: { locale: Locale; id: string }) {
  const t = await findTournament(id);
  if (!t) notFound();
  const view = buildPublicView(t);
  return (
    <>
      <Breadcrumbs
        locale={locale}
        items={[{ name: view.name, path: localizedPath("tournament", locale, { id }) }]}
      />
      <JsonLd data={[eventLd(view, locale)]} />
      <PublicTournamentPage tournament={view} />
    </>
  );
}
