"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { useCollection } from "@/components/CollectionProvider";
import { safeNextPath } from "@/lib/safe-next";

/** Connexion / inscription depuis les pages publiques, puis retour à `next` (accueil par défaut). */
export function LoginScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const { user } = useCollection();
  const mode = params.get("mode");
  const next = safeNextPath(params.get("next"));

  useEffect(() => {
    if (user) router.replace(next);
  }, [user, next, router]);

  if (user) return null;
  return <AuthScreen initialMode={mode === "register" || mode === "login" ? mode : null} redirectTo={null} />;
}
