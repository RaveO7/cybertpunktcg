import { cookies } from "next/headers";
import { Dashboard } from "@/components/Dashboard";
import { UseStoredLocale } from "@/components/LocaleProvider";
import { Landing, landingMetadata } from "@/components/public-site/Landing";
import { RequireUser } from "@/components/site/RequireUser";
import { SESSION_COOKIE } from "@/lib/auth";

export const metadata = landingMetadata("fr");

/**
 * Sans cookie de session (visiteur, robot) : page de présentation rendue côté serveur.
 * Avec : tableau de bord, protégé comme avant (session expirée → écran de connexion).
 */
export default async function HomePage() {
  const hasSession = (await cookies()).has(SESSION_COOKIE);
  if (!hasSession) return <Landing locale="fr" />;
  return (
    <RequireUser>
      <UseStoredLocale />
      <Dashboard />
    </RequireUser>
  );
}
