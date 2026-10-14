import type { Metadata } from "next";
import { TournamentDetail, tournamentMetadata } from "@/components/public-site/tournament-pages";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return tournamentMetadata("fr", (await params).id);
}

export default async function PublicTournamentDetailPage({ params }: PageProps) {
  return <TournamentDetail locale="fr" id={(await params).id} />;
}
