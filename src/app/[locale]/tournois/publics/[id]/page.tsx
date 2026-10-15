import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { TournamentDetail, tournamentMetadata } from "@/components/public-site/tournament-pages";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return tournamentMetadata(await getLocale(), (await params).id);
}

export default async function PublicTournamentDetailPage({ params }: PageProps) {
  return <TournamentDetail locale={await getLocale()} id={(await params).id} />;
}
