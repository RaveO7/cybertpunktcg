import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { DecksScreen, DecksSkeleton } from "@/components/DecksScreen";
import { NewDeckButton } from "@/components/decks/NewDeckButton";
import { RequireUser } from "@/components/site/RequireUser";
import { privateMetadata } from "@/lib/seo/metadata";

// Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée.
export const metadata = privateMetadata;

/**
 * Titre et intro rendus par le serveur, hors de la vérification de session (RequireUser porté par la page,
 * voir AppFrame) : affichés dès le HTML et jamais recréés ensuite, sinon Lighthouse mobile compterait leur
 * nouvel affichage comme LCP, après tout le JS. Masqués sous l'éditeur d'un deck et l'écran de connexion
 * (`data-hides-page-header`).
 */
export default async function DecksPage() {
  const t = await getTranslations("decks");
  return (
    <div className="group/decks flex min-w-0 flex-col">
      <div className="mx-auto flex w-full min-w-0 max-w-[1100px] flex-wrap items-end justify-between gap-3 px-3 pt-4 group-has-[[data-hides-page-header]]/decks:hidden sm:px-4 sm:pt-6">
        <div>
          <h1 className="text-2xl text-yellow sm:text-4xl">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">{t("subtitle")}</p>
        </div>
        <NewDeckButton />
      </div>
      <RequireUser pending={<DecksSkeleton />}>
        <Suspense fallback={<DecksSkeleton />}>
          <DecksScreen />
        </Suspense>
      </RequireUser>
    </div>
  );
}
