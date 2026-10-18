import { getLocale } from "next-intl/server";
import { Dashboard } from "@/components/Dashboard";
import { RequireUser } from "@/components/site/RequireUser";
import { homeCopy, pageMetadata } from "@/lib/seo/metadata";

// Mêmes métadonnées que l'accueil, dont il prend l'adresse (adresse canonique comprise).
export async function generateMetadata() {
  const locale = await getLocale();
  const home = await homeCopy(locale);
  return pageMetadata({ locale, page: { key: "home" }, title: home.title, absoluteTitle: true, description: home.description });
}

/**
 * Accueil d'un compte connecté, servi par le proxy à l'adresse de l'accueil (« /fr ») quand un cookie de
 * session est présent : page statique, sans le JS de la présentation des visiteurs. Session expirée →
 * écran de connexion (RequireUser).
 */
export default function DashboardPage() {
  return (
    <RequireUser>
      <Dashboard />
    </RequireUser>
  );
}
