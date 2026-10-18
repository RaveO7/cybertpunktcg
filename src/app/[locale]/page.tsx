import { getLocale } from "next-intl/server";
import { Landing } from "@/components/public-site/Landing";
import { homeCopy, pageMetadata } from "@/lib/seo/metadata";

// Annuaires des tournois et des boutiques lus en base à chaque visite.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const locale = await getLocale();
  const home = await homeCopy(locale);
  return pageMetadata({ locale, page: { key: "home" }, title: home.title, absoluteTitle: true, description: home.description });
}

/**
 * Accueil des visiteurs (et robots) : page de présentation rendue côté serveur. Avec un cookie de session,
 * le proxy sert à la même adresse le tableau de bord (tableau-de-bord/page.tsx).
 */
export default async function HomePage() {
  return <Landing locale={await getLocale()} />;
}
