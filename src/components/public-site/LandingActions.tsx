"use client";

import { Link } from "@/i18n/navigation";
import { useCollection } from "@/components/CollectionProvider";

/**
 * Appels à l'action de l'accueil : inscription (et connexion si `login` est fourni), ou accès à
 * l'application si connecté.
 */
export function LandingActions({ register, login, openApp }: { register: string; login?: string; openApp: string }) {
  const { user } = useCollection();
  if (user) {
    return (
      <Link href="/" className="cp-btn">
        {openApp}
      </Link>
    );
  }
  return (
    <>
      <Link href={{ pathname: "/connexion", query: { mode: "register" } }} rel="nofollow" className="cp-btn">
        {register}
      </Link>
      {login ? (
        <Link href={{ pathname: "/connexion", query: { mode: "login" } }} rel="nofollow" className="cp-btn cp-btn-ghost">
          {login}
        </Link>
      ) : null}
    </>
  );
}
