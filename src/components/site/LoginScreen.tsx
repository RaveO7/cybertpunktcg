"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { useEffect } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { useCollection } from "@/components/CollectionProvider";
import { getPathname } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/safe-next";

/**
 * Connexion / inscription depuis les pages publiques, puis retour à `next` (URL complète, dans sa
 * langue), sinon à l'accueil de la langue de l'écran de connexion.
 */
export function LoginScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useCollection();
  const mode = params.get("mode");
  const locale = useLocale();
  const next = safeNextPath(params.get("next"), getPathname({ href: "/", locale }));

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  if (user) return null;
  return <AuthScreen initialMode={mode === "register" || mode === "login" ? mode : null} redirectTo={null} />;
}
