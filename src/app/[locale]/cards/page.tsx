import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { CardsExplorer } from "@/components/CardsExplorer";
import { firstGridImages } from "@/lib/cards-preload";
import { loadCatalogCached } from "@/lib/catalog";
import { CARDS_VIEW_COOKIE, parseCardsViewCookie } from "@/lib/preferences";
import { privateMetadata } from "@/lib/seo/metadata";

// Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée.
export const metadata = privateMetadata;

/** Première rangée la plus large de la grille (4 colonnes) ; les 2 premières sont visibles à toutes les largeurs. */
const PRELOADED_CARDS = 4;
const HIGH_PRIORITY_CARDS = 2;

export default async function CardsPage({ searchParams }: PageProps<"/[locale]/cards">) {
  const [t, images] = await Promise.all([getTranslations(), firstCardImages(searchParams)]);
  return (
    <>
      {/* Balises rendues par la page, donc toujours dans le HTML : `preload()` de react-dom, appelé une fois
          le <head> parti, n'arrive que dans les données React, lues après le chargement du JavaScript. */}
      {images.map((href, index) => (
        <link key={href} rel="preload" as="image" href={href} fetchPriority={index < HIGH_PRIORITY_CARDS ? "high" : "auto"} />
      ))}
      <Suspense fallback={<p className="p-6 text-sm text-muted">{t("cards.loading")}</p>}>
        <CardsExplorer />
      </Suspense>
    </>
  );
}

/** Images des premières cartes de la grille (image LCP de la page), à précharger dès le HTML. */
async function firstCardImages(searchParams: PageProps<"/[locale]/cards">["searchParams"]) {
  const [query, cookieStore, catalog] = await Promise.all([searchParams, cookies(), loadCatalogCached()]);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  }
  const view = parseCardsViewCookie(cookieStore.get(CARDS_VIEW_COOKIE)?.value);
  return firstGridImages(catalog, params, view, PRELOADED_CARDS);
}
