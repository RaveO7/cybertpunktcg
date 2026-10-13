import { InviteScreen } from "@/components/tournament/LinkScreens";
import { privateMetadata } from "@/lib/seo/metadata";

// Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée.
export const metadata = privateMetadata;

type PageProps = { params: Promise<{ token: string }> };

export default async function TournamentInvitePage({ params }: PageProps) {
  const { token } = await params;
  return <InviteScreen token={token} />;
}
