"use client";

import { BottomNav, Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { OfflineBanner } from "@/components/OfflineSupport";
import { EnglishSuggestion } from "@/components/site/EnglishSuggestion";
import { RequireUser } from "@/components/site/RequireUser";
import { routeOfPath } from "@/lib/seo/routes";
import { LEGAL_PATHS } from "@/lib/site";
import { usePathname } from "next/navigation";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isSharedView = pathname.startsWith("/classeur/");
  // Pages joueur d'un tournoi (/t/…), pages publiques bilingues (accueil, catalogue, tutoriel, tournois
  // publics, boutiques), connexion et pages légales : ouvertes aux invités sans compte. L'accueil
  // protège lui-même le tableau de bord des utilisateurs connectés.
  const isPublicPage =
    isSharedView ||
    pathname.startsWith("/t/") ||
    routeOfPath(pathname) !== null ||
    pathname === "/connexion" ||
    LEGAL_PATHS.includes(pathname);
  // Le didacticiel occupe toute la hauteur : pas de pied de page.
  const showFooter = !pathname.startsWith("/comment-jouer") && !pathname.startsWith("/en/how-to-play");
  const content = isPublicPage ? children : <RequireUser>{children}</RequireUser>;
  return (
    <div className="relative flex h-dvh flex-col overflow-clip">
      <Header />
      <OfflineBanner />
      <EnglishSuggestion />
      <main className="app-main @container/main px-safe relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain [container-type:size]">
        {content}
        {showFooter ? <Footer /> : null}
      </main>
      <BottomNav />
    </div>
  );
}
