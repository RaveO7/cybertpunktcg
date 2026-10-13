import { ShopsDirectory } from "@/components/public-site/shop-pages";
import type { SearchParams } from "@/components/public-site/tournament-pages";
import { privateMetadata } from "@/lib/seo/metadata";

// Annuaire réservé aux comptes (visiteurs renvoyés vers l'accueil par src/proxy.ts).
export const metadata = privateMetadata;

export default function ShopsPage({ searchParams }: { searchParams: SearchParams }) {
  return <ShopsDirectory searchParams={searchParams} />;
}
