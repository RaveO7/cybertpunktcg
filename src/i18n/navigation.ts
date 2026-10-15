import type { ComponentProps } from "react";
import { createNavigation } from "next-intl/navigation";
import { routing } from "@/i18n/routing";

/** Liens et navigation dans la langue de la page (segments d'URL traduits, préfixe de langue). */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);

/**
 * Destination interne acceptée par `Link` et `useRouter` : route connue (« /decks ») ou route avec
 * paramètres et query (`{ pathname: "/tournois/[id]", params: { id } }`).
 */
export type Href = Parameters<ReturnType<typeof useRouter>["push"]>[0];

/** Destination acceptée par `Link` seulement : comme `Href`, avec en plus une ancre (`hash`). */
export type LinkHref = ComponentProps<typeof Link>["href"];
