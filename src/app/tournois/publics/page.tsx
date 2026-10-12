import type { Metadata } from "next";
import { apiParams, cleanParams } from "@/components/public/directory-params";
import { PublicDirectory } from "@/components/public/PublicDirectory";
import { directoryQuerySchema, validateSearchParams } from "@/lib/api-schemas";
import { directoryQueryFromParams, searchPublicTournaments } from "@/lib/tournament/directory";

export const metadata: Metadata = {
  title: "Tournois publics Cyberpunk TCG",
  description: "Trouvez un tournoi Cyberpunk TCG près de chez vous : boutiques, dates, formats et places restantes.",
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/** Premier rendu côté serveur (indexable, sans attente) ; le client prend ensuite le relais. */
export default async function PublicTournamentsPage({ searchParams }: PageProps) {
  const params = cleanParams(await searchParams);
  const parsed = validateSearchParams(directoryQuerySchema, apiParams(params, new Date()));
  const initial = parsed.ok ? await searchPublicTournaments(directoryQueryFromParams(parsed.data)) : null;
  return <PublicDirectory initialParams={params} initial={initial} />;
}
