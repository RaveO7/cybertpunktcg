import { CatalogPage, catalogMetadata } from "@/components/public-site/catalog-pages";

// Liste prérendue, régénérée au plus toutes les heures (comme les fiches).
export const revalidate = 3600;

export function generateMetadata() {
  return catalogMetadata("en");
}

export default function PublicCardsPage() {
  return <CatalogPage locale="en" />;
}
