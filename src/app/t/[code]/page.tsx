import { PlayerScreen } from "@/components/tournament/PlayerScreen";

type PageProps = { params: Promise<{ code: string }> };

export default async function TournamentPlayerPage({ params }: PageProps) {
  const { code } = await params;
  return <PlayerScreen code={code} />;
}
