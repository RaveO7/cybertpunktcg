import { TournamentConsole } from "@/components/tournament/TournamentConsole";
import { privateMetadata } from "@/lib/seo/metadata";

// Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée.
export const metadata = privateMetadata;

type PageProps = { params: Promise<{ id: string }> };

export default async function TournamentConsolePage({ params }: PageProps) {
  const { id } = await params;
  return <TournamentConsole tournamentId={id} />;
}
