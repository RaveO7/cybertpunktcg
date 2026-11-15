import { getLocale } from "next-intl/server";
import { Landing } from "@/components/public-site/Landing";
import { homeCopy, pageMetadata } from "@/lib/seo/metadata";

// Générée à l'avance (le bouton « retour » la restaure sans la recharger) et régénérée après chaque écriture
// dans l'annuaire (src/lib/prisma.ts). Les annuaires sont redemandés par le navigateur à l'affichage ;
// délai de secours pour les tournois qui commencent, sans écriture en base.
export const revalidate = 300;

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
