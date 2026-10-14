import { PlayerScreen } from "@/components/tournament/PlayerScreen";
import { privateMetadata } from "@/lib/seo/metadata";

// Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée.
export const metadata = privateMetadata;

type PageProps = { params: Promise<{ code: string }> };

export default async function TournamentPlayerPage({ params }: PageProps) {
  const { code } = await params;
  return <PlayerScreen code={code} />;
}
