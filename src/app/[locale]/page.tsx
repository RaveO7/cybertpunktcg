import dynamic from "next/dynamic";
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { Dashboard } from "@/components/Dashboard";
import { RequireUser } from "@/components/site/RequireUser";
import { SESSION_COOKIE } from "@/lib/auth";
import { homeCopy, pageMetadata } from "@/lib/seo/metadata";

// Import dynamique : les composants client de la page de présentation (annuaires, QR codes, animations)
// ne sont chargés que pour les visiteurs, pas au démarrage du tableau de bord.
const Landing = dynamic(() => import("@/components/public-site/Landing").then((module) => module.Landing));

export async function generateMetadata() {
  const locale = await getLocale();
  const home = await homeCopy(locale);
  return pageMetadata({ locale, page: { key: "home" }, title: home.title, absoluteTitle: true, description: home.description });
}

/**
 * Sans cookie de session (visiteur, robot) : page de présentation rendue côté serveur.
 * Avec : tableau de bord, protégé comme avant (session expirée → écran de connexion).
 */
export default async function HomePage() {
  const hasSession = (await cookies()).has(SESSION_COOKIE);
  if (!hasSession) return <Landing locale={await getLocale()} />;
  return (
    <RequireUser>
      <Dashboard />
    </RequireUser>
  );
}
