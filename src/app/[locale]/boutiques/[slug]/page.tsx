import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { ShopDetailPage, shopMetadata } from "@/components/public-site/shop-pages";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return shopMetadata(await getLocale(), (await params).slug);
}

export default async function ShopPublicPage({ params }: PageProps) {
  return <ShopDetailPage locale={await getLocale()} slug={(await params).slug} />;
}
