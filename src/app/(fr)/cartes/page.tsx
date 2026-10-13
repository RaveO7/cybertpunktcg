import { CatalogPage, catalogMetadata } from "@/components/public-site/catalog-pages";
import type { SearchParams } from "@/components/public-site/tournament-pages";

export function generateMetadata() {
  return catalogMetadata("fr");
}

export default function PublicCardsPage({ searchParams }: { searchParams: SearchParams }) {
  return <CatalogPage locale="fr" searchParams={searchParams} />;
}
