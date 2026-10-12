import type { Metadata } from "next";
import { ShopDirectory } from "@/components/shops/ShopDirectory";
import { shopDirectoryQuerySchema, validateSearchParams } from "@/lib/api-schemas";
import { listPublicShops } from "@/lib/shops/shops";

export const metadata: Metadata = {
  title: "Boutiques Cyberpunk TCG",
  description: "Les boutiques qui organisent des tournois Cyberpunk TCG près de chez vous.",
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ShopsPage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const params = Object.fromEntries(
    Object.entries(raw).flatMap(([key, value]) => {
      const first = Array.isArray(value) ? value[0] : value;
      return first ? [[key, first.slice(0, 120)]] : [];
    }),
  ) as Record<string, string>;
  const query = new URLSearchParams(params);
  query.delete("place");
  query.delete("view");
  const parsed = validateSearchParams(shopDirectoryQuerySchema, query);
  const initial = parsed.ok ? await listPublicShops(parsed.data) : null;
  return <ShopDirectory initialParams={params} initial={initial} />;
}
