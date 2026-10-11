import { InviteScreen } from "@/components/tournament/LinkScreens";

type PageProps = { params: Promise<{ token: string }> };

export default async function TournamentInvitePage({ params }: PageProps) {
  const { token } = await params;
  return <InviteScreen token={token} />;
}
