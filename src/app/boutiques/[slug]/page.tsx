import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShopPage } from "@/components/shops/ShopPage";
import { findPublicShop, toDetail } from "@/lib/shops/shops";
import { shopTournaments } from "@/lib/tournament/directory";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const shop = await findPublicShop((await params).slug);
  if (!shop) return { title: "Boutique introuvable" };
  return {
    title: `${shop.name} · Boutique Cyberpunk TCG`,
    description: shop.description?.slice(0, 160) || `Tournois Cyberpunk TCG à ${shop.city}.`,
  };
}

export default async function ShopPublicPage({ params }: PageProps) {
  const shop = await findPublicShop((await params).slug);
  if (!shop) notFound();
  const { upcoming, past } = await shopTournaments(shop.id);
  return <ShopPage shop={toDetail(shop)} upcoming={upcoming} past={past} />;
}
