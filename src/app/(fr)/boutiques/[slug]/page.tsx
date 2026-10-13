import type { Metadata } from "next";
import { ShopDetailPage, shopMetadata } from "@/components/public-site/shop-pages";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return shopMetadata("fr", (await params).slug);
}

export default async function ShopPublicPage({ params }: PageProps) {
  return <ShopDetailPage locale="fr" slug={(await params).slug} />;
}
