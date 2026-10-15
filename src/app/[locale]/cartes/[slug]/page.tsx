import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { CardPage, cardMetadata, cardStaticParams } from "@/components/public-site/catalog-pages";

type PageProps = { params: Promise<{ slug: string }> };

// Fiches prérendues au build, régénérées au plus toutes les heures (et à l'import des prix).
export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return cardStaticParams();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return cardMetadata(await getLocale(), (await params).slug);
}

export default async function PublicCardPage({ params }: PageProps) {
  return <CardPage locale={await getLocale()} slug={(await params).slug} />;
}
