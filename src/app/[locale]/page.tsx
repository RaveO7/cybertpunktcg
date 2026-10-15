import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { Dashboard } from "@/components/Dashboard";
import { Landing, landingMetadata } from "@/components/public-site/Landing";
import { RequireUser } from "@/components/site/RequireUser";
import { SESSION_COOKIE } from "@/lib/auth";

export async function generateMetadata() {
  return landingMetadata(await getLocale());
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
