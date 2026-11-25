"use client";

import NextLink from "next/link";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { NavBadge } from "@/components/header/NavBadge";
import { SettingsIcon } from "@/components/header/SettingsIcon";
import { SyncErrors } from "@/components/header/SyncErrors";
import { SyncStatus } from "@/components/header/SyncStatus";
import { useNavigation } from "@/components/header/use-navigation";
import { VisitorNav } from "@/components/header/VisitorNav";

export function Header({ privatePage }: { privatePage: boolean }) {
  const { pathname, user, session, t, isSharedView, shareToken, showNav, links, activeMatch, markPending } = useNavigation();
  // Page réservée aux comptes, session pas encore connue (écran de démarrage par-dessus) : place du bouton
  // des paramètres gardée, sinon l'en-tête grandit à l'arrivée de la session et décale toute la page.
  const awaitingSession = privatePage && (session === "unknown" || session === "guest");
  // Visiteur sur une page publique (aussi au rendu serveur, pour les liens internes) : navigation publique.
  const showVisitorNav = !user && !isSharedView && !showNav && !awaitingSession && pathname !== "/connexion";
  // Page d'où l'on a ouvert les paramètres (URL complète, dans sa langue) : un second clic y ramène.
  const [settingsReturn, setSettingsReturn] = useState<string | null>(null);
  const inSettings = pathname === "/parametres";

  const actionClass =
    "inline-flex size-10 shrink-0 items-center justify-center border border-line text-muted hover:border-cyan hover:text-foreground";

  return (
    <header className="pt-safe px-safe relative z-30 shrink-0 border-b border-line bg-background">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-2">
        <Link
          href={isSharedView && shareToken ? { pathname: "/classeur/[token]", params: { token: shareToken } } : "/"}
          className="shrink-0 text-sm text-yellow"
        >
          TCG Tracker
        </Link>
        {showNav ? (
          // Sur téléphone, la navigation passe dans la barre d'onglets du bas (BottomNav).
          <nav className="ml-auto hidden border border-line sm:flex" aria-label={t("common.sections")}>
            {links.map((link) => {
              const active = activeMatch === link.match;
              return (
                <Link
                  key={link.match}
                  href={link.href}
                  prefetch={link.fullPrefetch}
                  onClick={() => markPending(link.match)}
                  className={`px-3 py-2 text-sm ${active ? "bg-yellow text-black" : "text-muted hover:text-foreground"}`}
                  aria-current={active ? "page" : undefined}
                >
                  {link.label}
                  <NavBadge count={link.badge} label={(n) => t("wishlist.newAlerts", { n })} />
                </Link>
              );
            })}
          </nav>
        ) : showVisitorNav ? (
          <VisitorNav />
        ) : null}
        {user && !isSharedView ? <SyncStatus /> : null}
        {user && !isSharedView ? (
          inSettings && settingsReturn ? (
            <NextLink
              href={settingsReturn}
              className={`${actionClass} ml-auto border-yellow bg-yellow text-black hover:border-yellow hover:text-black sm:ml-0`}
              aria-label={t("common.settings")}
              title={t("common.settings")}
              aria-current="page"
            >
              <SettingsIcon />
            </NextLink>
          ) : (
            <Link
              href={inSettings ? "/" : "/parametres"}
              onClick={() => {
                if (!inSettings) setSettingsReturn(window.location.pathname + window.location.search);
              }}
              className={`${actionClass} ml-auto sm:ml-0 ${inSettings ? "border-yellow bg-yellow text-black hover:border-yellow hover:text-black" : ""}`}
              aria-label={t("common.settings")}
              title={t("common.settings")}
              aria-current={inSettings ? "page" : undefined}
            >
              <SettingsIcon />
            </Link>
          )
        ) : awaitingSession ? (
          <span className={`${actionClass} invisible ml-auto sm:ml-0`} aria-hidden="true" />
        ) : null}
      </div>
      {user && !isSharedView ? <SyncErrors /> : null}
    </header>
  );
}
