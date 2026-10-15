import { getLocale } from "next-intl/server";
import { CatalogPage, catalogMetadata } from "@/components/public-site/catalog-pages";

// Liste prérendue, régénérée au plus toutes les heures (comme les fiches).
export const revalidate = 3600;

export async function generateMetadata() {
  return catalogMetadata(await getLocale());
}

export default async function PublicCardsPage() {
  return <CatalogPage locale={await getLocale()} />;
}
