import { TournamentConsole } from "@/components/tournament/TournamentConsole";

type PageProps = { params: Promise<{ id: string }> };

export default async function TournamentConsolePage({ params }: PageProps) {
  const { id } = await params;
  return <TournamentConsole tournamentId={id} />;
}
