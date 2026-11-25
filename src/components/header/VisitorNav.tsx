"use client";

import { usePathname as useBrowserPathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LanguageSelect } from "./LanguageSelect";

/** Barre des visiteurs sans compte : tout est sur l'accueil, donc seulement la langue et la connexion. */
export function VisitorNav() {
  const t = useTranslations();
  // Retour après connexion : l'URL affichée, dans sa langue.
  const next = useBrowserPathname();
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      <LanguageSelect />
      <Link href={{ pathname: "/connexion", query: { next } }} rel="nofollow" className="cp-btn cp-btn-sm">
        {t("nav.login")}
      </Link>
    </div>
  );
}
