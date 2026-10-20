import sharp from "sharp";
import { translatorFor } from "@/i18n/server";
import { loadCatalogCached } from "@/lib/catalog";
import { thumbnailPath } from "@/lib/card-image";
import { cardLabel } from "@/lib/deck-rules";
import { legendImages, loadSharedDeck, summarizeSharedDeck } from "@/lib/deck-share";
import { OG_CARD, isLocale, ogImage } from "@/lib/seo/og-image";

/** Visuel d'une carte converti en PNG pour le moteur de rendu ; null s'il est indisponible. */
async function cardPng(request: Request, imagePath: string) {
  try {
    const url = new URL(thumbnailPath(imagePath) ?? imagePath, request.url);
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) return null;
    const png = await sharp(Buffer.from(await response.arrayBuffer()))
      .resize(OG_CARD.width, OG_CARD.height, { fit: "contain", background: "#000000" })
      .png()
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Image de partage d'un deck : nom, propriétaire et visuels des Legends. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string; locale: string }> }) {
  const { token, locale } = await params;
  if (!isLocale(locale)) return new Response("Not found", { status: 404 });
  const deck = await loadSharedDeck(token);
  if (!deck) return new Response("Not found", { status: 404 });
  const [catalog, tDecks, tSite] = await Promise.all([loadCatalogCached(), translatorFor(locale, "decks"), translatorFor(locale, "site")]);
  const summary = summarizeSharedDeck(deck.cards, catalog);
  const legends = summary.analysis.legends.slice(0, 3);
  const images = legendImages(legends, catalog.printings);
  const cards = await Promise.all(legends.map((line) => (images[line.card.id] ? cardPng(request, images[line.card.id]) : null)));
  return ogImage({
    eyebrow: tSite("og.deck"),
    title: deck.name,
    lines: [
      tDecks("sharedBy", { name: deck.owner.displayName }),
      cards.some(Boolean) ? tDecks("sharedTotal", { n: summary.totalCards }) : legends.map((line) => cardLabel(line.card)).join(", "),
    ].filter(Boolean),
    cards: cards.filter((card): card is string => card !== null),
  });
}
