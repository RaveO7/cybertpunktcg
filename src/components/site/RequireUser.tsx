"use client";

import { useTranslations } from "next-intl";
import { AuthScreen } from "@/components/AuthScreen";
import { useCollection } from "@/components/CollectionProvider";

/** Page réservée aux comptes : rien n'est rendu tant que la session n'est pas vérifiée. */
export function RequireUser({ children }: { children: React.ReactNode }) {
  const { ready, user } = useCollection();
  const t = useTranslations();
  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm opacity-70" role="status" aria-live="polite">
        {t("common.loading")}
      </div>
    );
  }
  if (!user) return <AuthScreen />;
  return <>{children}</>;
}
