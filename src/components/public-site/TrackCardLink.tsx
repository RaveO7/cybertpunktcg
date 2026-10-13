"use client";

import Link from "next/link";
import { useCollection } from "@/components/CollectionProvider";

/**
 * « Ajouter à ma collection » : ouvre la carte dans l'explorateur pour un utilisateur connecté,
 * mène à la création de compte sinon (puis à la carte). Rendu serveur : version visiteur.
 */
export function TrackCardLink({ printingId, label, className }: { printingId?: string | null; label: string; className?: string }) {
  const { user } = useCollection();
  // L'explorateur ouvre la fiche d'une impression avec ?printing=<id>.
  const target = printingId ? `/cards?printing=${encodeURIComponent(printingId)}` : "/cards";
  const href = user ? target : `/connexion?mode=register&next=${encodeURIComponent(target)}`;
  return (
    <Link href={href} rel="nofollow" className={className}>
      {label}
    </Link>
  );
}
