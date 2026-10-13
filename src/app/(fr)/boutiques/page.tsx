import { ShopsDirectory, shopsDirectoryMetadata } from "@/components/public-site/shop-pages";
import type { SearchParams } from "@/components/public-site/tournament-pages";

export const metadata = shopsDirectoryMetadata("fr");

export default function ShopsPage({ searchParams }: { searchParams: SearchParams }) {
  return <ShopsDirectory locale="fr" searchParams={searchParams} />;
}
