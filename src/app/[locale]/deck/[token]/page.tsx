import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { SharedDeckView } from "@/components/decks/SharedDeckView";
import { loadCatalogCached } from "@/lib/catalog";
import { cardLabel } from "@/lib/deck-rules";
import { legendImages, loadSharedDeck, summarizeSharedDeck } from "@/lib/deck-share";
import { privateMetadata } from "@/lib/seo/metadata";
import { DEFAULT_LOCALE, isLocale } from "@/i18n/config";
import { translatorFor } from "@/i18n/server";

// Rendue à chaque visite : la page reflète l'état courant du deck (et un lien révoqué répond 404).
export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ locale: string; token: string }> };

// Une seule lecture par requête pour les métadonnées et la page.
const loadDeck = cache(loadSharedDeck);

/** Lien à jeton : jamais indexé, mais un titre et une image pour les aperçus de lien des messageries. */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token, locale: segment } = await params;
  const locale = isLocale(segment) ? segment : DEFAULT_LOCALE;
  const deck = await loadDeck(token);
  if (!deck) return privateMetadata;
  const [t, catalog] = await Promise.all([translatorFor(locale, "decks"), loadCatalogCached()]);
  const summary = summarizeSharedDeck(deck.cards, catalog);
  const legends = summary.analysis.legends.map((line) => cardLabel(line.card)).join(", ");
  const description = [t("sharedBy", { name: deck.owner.displayName }), t("sharedTotal", { n: summary.totalCards }), legends]
    .filter(Boolean)
    .join(" · ");
  const image = { url: `/og/deck/${encodeURIComponent(token)}/${locale}`, width: 1200, height: 630, alt: deck.name };
  return {
    ...privateMetadata,
    title: deck.name,
    description,
    openGraph: { title: deck.name, description, type: "website", images: [image] },
    twitter: { card: "summary_large_image", title: deck.name, description, images: [image.url] },
  };
}

export default async function SharedDeckPage({ params }: PageProps) {
  const { token } = await params;
  const deck = await loadDeck(token);
  if (!deck) notFound();
  const catalog = await loadCatalogCached();
  const summary = summarizeSharedDeck(deck.cards, catalog);
  return (
    <SharedDeckView
      name={deck.name}
      ownerName={deck.owner.displayName}
      summary={summary}
      legendImages={legendImages(summary.analysis.legends, catalog.printings)}
    />
  );
}
