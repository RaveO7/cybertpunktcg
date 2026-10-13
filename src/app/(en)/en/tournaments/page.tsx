import { TournamentsDirectory, tournamentsDirectoryMetadata, type SearchParams } from "@/components/public-site/tournament-pages";

export const metadata = tournamentsDirectoryMetadata("en");

export default function PublicTournamentsPage({ searchParams }: { searchParams: SearchParams }) {
  return <TournamentsDirectory locale="en" searchParams={searchParams} />;
}
