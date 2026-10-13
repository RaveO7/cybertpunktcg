import { TournamentsDirectory, tournamentsDirectoryMetadata, type SearchParams } from "@/components/public-site/tournament-pages";

export const metadata = tournamentsDirectoryMetadata("fr");

export default function PublicTournamentsPage({ searchParams }: { searchParams: SearchParams }) {
  return <TournamentsDirectory locale="fr" searchParams={searchParams} />;
}
