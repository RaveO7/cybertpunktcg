import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { InvestmentScreen, InvestmentSkeleton } from "@/components/InvestmentScreen";
import { RequireUser } from "@/components/site/RequireUser";
import { privateMetadata } from "@/lib/seo/metadata";

// Page privée, derrière connexion : jamais indexée.
export const metadata = privateMetadata;

/**
 * Titre et intro fixes rendus par le serveur, hors de la vérification de session : affichés dès le HTML et
 * jamais recréés, ils comptent comme LCP dès le premier affichage (les chiffres, calculés sur la collection
 * et les prix, n'arrivent qu'après le JS et les données). Masqués sous l'écran de connexion
 * (`data-hides-page-header`).
 */
export default async function InvestmentPage() {
  const t = await getTranslations("investment");
  return (
    <div className="group/page flex min-w-0 flex-col">
      <div className="mx-auto w-full max-w-[1600px] px-3 pt-4 group-has-[[data-hides-page-header]]/page:hidden sm:px-4 sm:pt-6">
        <h1 className="text-2xl text-yellow sm:text-4xl">{t("eyebrow")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t("pageIntro")}</p>
      </div>
      <RequireUser pending={<InvestmentSkeleton />}>
        <Suspense fallback={<InvestmentSkeleton />}>
          <InvestmentScreen />
        </Suspense>
      </RequireUser>
    </div>
  );
}
