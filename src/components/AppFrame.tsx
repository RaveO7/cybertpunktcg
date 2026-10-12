"use client";

import { AuthScreen } from "@/components/AuthScreen";
import { BottomNav, Header } from "@/components/Header";
import { useCollection } from "@/components/CollectionProvider";
import { Footer } from "@/components/Footer";
import { useI18n } from "@/components/LocaleProvider";
import { OfflineBanner } from "@/components/OfflineSupport";
import { LEGAL_PATHS } from "@/lib/site";
import { usePathname } from "next/navigation";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const { ready, user } = useCollection();
  const { t } = useI18n();
  const pathname = usePathname();
  const isSharedView = pathname.startsWith("/classeur/");
  // Pages joueur d'un tournoi (/t/…), tournois publics, boutiques et pages légales : ouvertes
  // aux invités sans compte.
  const isPublicPage =
    isSharedView ||
    pathname.startsWith("/t/") ||
    pathname === "/tournois/publics" ||
    pathname.startsWith("/tournois/publics/") ||
    pathname === "/boutiques" ||
    pathname.startsWith("/boutiques/") ||
    LEGAL_PATHS.includes(pathname);
  // Le didacticiel occupe toute la hauteur : pas de pied de page.
  const showFooter = !pathname.startsWith("/comment-jouer");
  // Tant que la session n'est pas vérifiée, aucune page protégée n'est rendue.
  let content: React.ReactNode = children;
  if (!isPublicPage) {
    if (!ready) {
      content = (
        <div className="flex flex-1 items-center justify-center text-sm opacity-70" role="status" aria-live="polite">
          {t.common.loading}
        </div>
      );
    } else if (!user) {
      content = <AuthScreen />;
    }
  }
  return (
    <div className="relative flex h-dvh flex-col overflow-clip">
      <Header />
      <OfflineBanner />
      <main className="app-main @container/main px-safe relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain [container-type:size]">
        {content}
        {showFooter ? <Footer /> : null}
      </main>
      <BottomNav />
    </div>
  );
}
