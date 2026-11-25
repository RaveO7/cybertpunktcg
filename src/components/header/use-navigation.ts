"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useBrowseSelection } from "@/components/BrowseSelection";
import { useCollection } from "@/components/CollectionProvider";
import { type Href } from "@/i18n/navigation";
import { useInternalPathname } from "@/i18n/useInternalPathname";

export type NavIcon = "dashboard" | "cards" | "investment" | "decks" | "tournaments" | "wishlist" | "howto" | "binder" | "settings";

// fullPrefetch : page rendue à la demande (tableau de bord), préchargée en entier pour s'ouvrir sans attente.
// Les autres écrans sont statiques, donc déjà préchargés en entier ; les forcer ferait invalider le cache
// du routeur à chaque changement de paramètres d'URL (« ?deck=… »).
export type NavLink = { href: Href; label: string; match: string; icon: NavIcon; badge?: number; fullPrefetch?: boolean };

export function useNavigation() {
  // Chemin interne (segments français, sans préfixe de langue) : repère l'onglet actif dans toutes les langues.
  const pathname = useInternalPathname();
  const { cardsHref } = useBrowseSelection();
  const { user, session } = useCollection();
  const t = useTranslations();
  const sharedMatch = pathname.match(/^\/classeur\/([^/]+)/);
  const isSharedView = Boolean(sharedMatch);
  const shareToken = sharedMatch?.[1] ?? null;
  const showNav = isSharedView || session === "signed-in";

  const links: NavLink[] = isSharedView && shareToken
    ? [
        {
          href: { pathname: "/classeur/[token]", params: { token: shareToken } },
          label: t("share.binderNav"),
          match: `/classeur/${shareToken}`,
          icon: "binder",
        },
        {
          href: { pathname: "/classeur/[token]/cartes", params: { token: shareToken } },
          label: t("nav.cards"),
          match: `/classeur/${shareToken}/cartes`,
          icon: "cards",
        },
      ]
    : [
        { href: "/", label: t("nav.dashboard"), match: "/", icon: "dashboard", fullPrefetch: true },
        { href: cardsHref, label: t("nav.cards"), match: "/cards", icon: "cards" },
        { href: "/investissement", label: t("nav.investment"), match: "/investissement", icon: "investment" },
        { href: "/decks", label: t("nav.decks"), match: "/decks", icon: "decks" },
        { href: "/tournois", label: t("nav.tournaments"), match: "/tournois", icon: "tournaments" },
        // Page /souhaits masquée pour l'instant. Pour la réafficher, lire `const { unseenAlerts } = useWishlist();`
        // en haut du hook puis ajouter :
        // { href: "/souhaits", label: t.nav.wishlist, match: "/souhaits", icon: "wishlist", badge: unseenAlerts },
        { href: "/comment-jouer", label: t("nav.howto"), match: "/comment-jouer", icon: "howto" },
      ];

  // Onglet cliqué : affiché comme actif dès le clic, sans attendre l'arrivée de la page. Oublié dès que
  // le chemin change (la page est arrivée).
  const [pending, setPending] = useState<{ from: string; match: string } | null>(null);
  const activeMatch = pending && pending.from === pathname ? pending.match : pathname;
  const markPending = (match: string) => setPending({ from: pathname, match });

  return { pathname, user, session, t, isSharedView, shareToken, showNav, links, activeMatch, markPending };
}
