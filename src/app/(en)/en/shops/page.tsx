import { ShopsDirectory, shopsDirectoryMetadata } from "@/components/public-site/shop-pages";
import type { SearchParams } from "@/components/public-site/tournament-pages";

export const metadata = shopsDirectoryMetadata("en");

export default function ShopsPage({ searchParams }: { searchParams: SearchParams }) {
  return <ShopsDirectory locale="en" searchParams={searchParams} />;
}
