import { getLocale, getTranslations } from "next-intl/server";
import { Dashboard, DashboardSkeleton } from "@/components/Dashboard";
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
 *
 * Titre et intro fixes rendus par le serveur, hors de la vérification de session : affichés dès le HTML et
 * jamais recréés, ils restent le plus grand texte de la page et comptent comme LCP dès le premier affichage
 * (le contenu, calculé sur la collection, n'arrive qu'après le JS et les données). Masqués sous l'écran de
 * connexion (`data-hides-page-header`).
 */
export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  return (
    <div className="group/page flex min-w-0 flex-col">
      <div className="mx-auto w-full max-w-[1400px] px-4 pt-6 group-has-[[data-hides-page-header]]/page:hidden sm:pt-8">
        <h1 className="text-2xl text-yellow sm:text-4xl">{t("pageTitle")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t("pageIntro")}</p>
      </div>
      <RequireUser pending={<DashboardSkeleton />}>
        <Dashboard />
      </RequireUser>
    </div>
  );
}
