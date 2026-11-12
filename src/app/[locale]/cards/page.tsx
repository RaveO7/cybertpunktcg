import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { Suspense } from "react";
import { preload } from "react-dom";
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
  const t = await getTranslations();
  return (
    <>
      <Suspense fallback={null}>
        <PreloadFirstCards searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<p className="p-6 text-sm text-muted">{t("cards.loading")}</p>}>
        <CardsExplorer />
      </Suspense>
    </>
  );
}

/** Précharge dès le HTML les images des premières cartes (image LCP de la page). */
async function PreloadFirstCards({ searchParams }: Pick<PageProps<"/[locale]/cards">, "searchParams">) {
  const [query, cookieStore, catalog] = await Promise.all([searchParams, cookies(), loadCatalogCached()]);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, item);
  }
  const view = parseCardsViewCookie(cookieStore.get(CARDS_VIEW_COOKIE)?.value);
  firstGridImages(catalog, params, view, PRELOADED_CARDS).forEach((href, index) => {
    preload(href, { as: "image", fetchPriority: index < HIGH_PRIORITY_CARDS ? "high" : "auto" });
  });
  return null;
}
