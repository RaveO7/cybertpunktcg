"use client";

import { useCollection } from "@/components/CollectionProvider";
import { BottomNav, Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { OfflineBanner } from "@/components/OfflineSupport";
import { LegacyLocalePreference, PreferredLanguageRedirect } from "@/components/site/PreferredLanguageRedirect";
import { RequireUser } from "@/components/site/RequireUser";
import { LEGAL_PATHS, WISHLIST_ENABLED } from "@/lib/site";
import { publicRouteOfPath } from "@/i18n/paths";
import { useInternalPathname } from "@/i18n/useInternalPathname";

export function AppFrame({ children }: { children: React.ReactNode }) {
  // Chemin interne (segments français, sans préfixe de langue) : mêmes règles dans toutes les langues.
  const pathname = useInternalPathname();
  const { session, error } = useCollection();
  const isSharedView = pathname.startsWith("/classeur/");
  // Deck partagé (/deck/…) : lisible sans compte, comme le classeur partagé.
  const isSharedDeck = pathname.startsWith("/deck/");
  // Pages joueur d'un tournoi (/t/…), pages publiques bilingues (accueil, catalogue, tutoriel, tournois
  // publics, boutiques), connexion et pages légales : ouvertes aux invités sans compte. L'accueil
  // protège lui-même le tableau de bord des utilisateurs connectés.
  const isPublicPage =
    isSharedView ||
    isSharedDeck ||
    pathname.startsWith("/t/") ||
    publicRouteOfPath(pathname) !== null ||
    pathname === "/connexion" ||
    LEGAL_PATHS.includes(pathname) ||
    // Fonctionnalité pas encore publiée : la page répond 404, inutile de passer par la connexion.
    (pathname === "/souhaits" && !WISHLIST_ENABLED);
  // Le didacticiel occupe toute la hauteur : pas de pied de page.
  // Écran de démarrage d'une page réservée aux comptes (voir RequireUser) : pas de pied de page, qui serait
  // seul en bas de l'écran puis repoussé par le contenu à son arrivée (décalage de mise en page).
  const awaitingSession = !isPublicPage && session === "unknown" && !error;
  const showFooter = !pathname.startsWith("/comment-jouer") && !awaitingSession;
  const content = isPublicPage ? children : <RequireUser>{children}</RequireUser>;
  return (
    <div className="relative flex h-dvh flex-col overflow-clip">
      <Header privatePage={!isPublicPage} />
      <OfflineBanner />
      <LegacyLocalePreference />
      <PreferredLanguageRedirect />
      <main className="app-main @container/main px-safe relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain [container-type:size]">
        {content}
        {showFooter ? <Footer /> : null}
      </main>
      <BottomNav />
    </div>
  );
}
