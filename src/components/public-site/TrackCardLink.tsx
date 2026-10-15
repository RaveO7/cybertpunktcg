"use client";

import { useLocale } from "next-intl";
import { getPathname, Link, type Href } from "@/i18n/navigation";
import { useCollection } from "@/components/CollectionProvider";

/**
 * « Ajouter à ma collection » : ouvre la carte dans l'explorateur pour un utilisateur connecté,
 * mène à la création de compte sinon (puis à la carte). Rendu serveur : version visiteur.
 */
export function TrackCardLink({ printingId, label, className }: { printingId?: string | null; label: string; className?: string }) {
  const { user } = useCollection();
  const locale = useLocale();
  // L'explorateur ouvre la fiche d'une impression avec ?printing=<id>.
  const target: Href = printingId ? { pathname: "/cards", query: { printing: printingId } } : "/cards";
  const href: Href = user ? target : { pathname: "/connexion", query: { mode: "register", next: getPathname({ href: target, locale }) } };
  return (
    <Link href={href} rel="nofollow" className={className}>
      {label}
    </Link>
  );
}
