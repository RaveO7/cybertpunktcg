"use client";

import Link from "next/link";
import { useCollection } from "@/components/CollectionProvider";

const primary = "inline-flex h-12 items-center bg-yellow px-5 text-sm font-semibold text-black hover:brightness-110";
const secondary = "inline-flex h-12 items-center border border-cyan px-5 text-sm text-cyan hover:bg-cyan/10";

/** Appels à l'action de l'accueil : inscription et connexion, ou accès à l'application si connecté. */
export function LandingActions({ register, login, openApp }: { register: string; login: string; openApp: string }) {
  const { user } = useCollection();
  if (user) {
    return (
      <Link href="/" className={primary}>
        {openApp}
      </Link>
    );
  }
  return (
    <>
      <Link href="/connexion?mode=register" rel="nofollow" className={primary}>
        {register}
      </Link>
      <Link href="/connexion?mode=login" rel="nofollow" className={secondary}>
        {login}
      </Link>
    </>
  );
}
