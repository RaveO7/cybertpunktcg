"use client";

import { AuthScreen } from "@/components/AuthScreen";
import { BottomNav, Header } from "@/components/Header";
import { useCollection } from "@/components/CollectionProvider";
import { useI18n } from "@/components/LocaleProvider";
import { usePathname } from "next/navigation";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const { ready, user } = useCollection();
  const { t } = useI18n();
  const pathname = usePathname();
  const isSharedView = pathname.startsWith("/classeur/");
  // Tant que la session n'est pas vérifiée, aucune page protégée n'est rendue.
  let content: React.ReactNode = children;
  if (!isSharedView) {
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
    <div className="flex h-dvh flex-col overflow-clip">
      <Header />
      <main className="app-main @container/main px-safe flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-y-contain [container-type:size]">
        {content}
      </main>
      <BottomNav />
    </div>
  );
}
