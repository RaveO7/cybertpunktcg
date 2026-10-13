// Pages publiques des tournois, partagées par /tournois/publics (fr) et /en/tournaments (en).

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
import { COPY } from "@/lib/seo/copy";
import { pageMetadata } from "@/lib/seo/metadata";
import { localizedPath, type SiteLocale } from "@/lib/seo/routes";
import { eventLd, tournamentListLd } from "@/lib/seo/structured-data";
import { directoryQueryFromParams, findPublicTournament, searchPublicTournaments } from "@/lib/tournament/directory";
import { buildPublicView } from "@/lib/tournament/public-view";

// Métadonnées et page lisent le même tournoi : une seule requête par rendu.
const findTournament = cache(findPublicTournament);

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export function tournamentsDirectoryMetadata(locale: SiteLocale): Metadata {
  const copy = COPY[locale].tournaments;
  return pageMetadata({ locale, page: { key: "tournaments" }, title: copy.metaTitle, description: copy.metaDescription });
}

/** Premier rendu côté serveur (indexable, sans attente) ; le client prend ensuite le relais. */
export async function TournamentsDirectory({ locale, searchParams }: { locale: SiteLocale; searchParams: SearchParams }) {
  const params = cleanParams(await searchParams);
  const parsed = validateSearchParams(directoryQuerySchema, apiParams(params, new Date()));
  const initial = parsed.ok ? await searchPublicTournaments(directoryQueryFromParams(parsed.data)) : null;
  return (
    <>
      <Breadcrumbs locale={locale} items={[{ name: COPY[locale].tournaments.crumb, path: localizedPath("tournaments", locale) }]} />
      <JsonLd data={[tournamentListLd(initial?.tournaments ?? [], locale)]} />
      <PublicDirectory initialParams={params} initial={initial} />
    </>
  );
}

export async function tournamentMetadata(locale: SiteLocale, id: string): Promise<Metadata> {
  const t = await findTournament(id);
  if (!t) return { title: COPY[locale].tournaments.crumb, robots: { index: false, follow: false } };
  const view = buildPublicView(t);
  const copy = COPY[locale].tournaments;
  const when = view.startsAt ? formatStart(view.startsAt, view.timeZone, locale, "long") : null;
  const where = [view.venueName, view.city].filter(Boolean).join(", ");
  const parts = [when, where, view.shop?.name ?? null].filter((part): part is string => Boolean(part));
  return pageMetadata({
    locale,
    page: { key: "tournament", params: { id } },
    title: copy.itemTitle(view.name),
    description: copy.itemDescription(parts),
    image: { url: `/og/tournament/${encodeURIComponent(id)}/${locale}`, width: 1200, height: 630, alt: view.name },
    // Tournoi annulé : la fiche reste consultable mais n'est plus indexée.
    noindex: view.status === "annule",
  });
}

export async function TournamentDetail({ locale, id }: { locale: SiteLocale; id: string }) {
  const t = await findTournament(id);
  if (!t) notFound();
  const view = buildPublicView(t);
  return (
    <>
      <Breadcrumbs
        locale={locale}
        items={[
          { name: COPY[locale].tournaments.crumb, path: localizedPath("tournaments", locale) },
          { name: view.name, path: localizedPath("tournament", locale, { id }) },
        ]}
      />
      <JsonLd data={[eventLd(view, locale)]} />
      <PublicTournamentPage tournament={view} />
    </>
  );
}
