"use client";

import { useLocale } from "next-intl";
import { useCollection } from "@/components/CollectionProvider";
import type { LinkHref } from "@/i18n/navigation";
import { landingSections } from "@/i18n/routing";

/**
 * Annuaire des tournois ou des boutiques : page dédiée pour un compte connecté, section de l'accueil
 * (dans la langue de la page) pour un visiteur, l'annuaire n'ayant pas de page publique.
 */
export function useDirectoryHref(section: "tournaments" | "shops"): LinkHref {
  const { user } = useCollection();
  const locale = useLocale();
  if (user) return section === "tournaments" ? "/tournois/publics" : "/boutiques";
  return { pathname: "/", hash: landingSections[locale][section] };
}
