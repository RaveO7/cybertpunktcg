import { ClaimScreen } from "@/components/tournament/LinkScreens";

type PageProps = { params: Promise<{ token: string }> };

export default async function TournamentClaimPage({ params }: PageProps) {
  const { token } = await params;
  return <ClaimScreen token={token} />;
}
