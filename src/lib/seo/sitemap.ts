import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { isSealedSetCode } from "@/lib/reference-data";
import { LOCALES } from "@/i18n/config";
import { localizedPath, type PublicRouteKey } from "@/i18n/paths";
import { absoluteUrl } from "@/lib/seo/site";

/** Tournois terminés gardés dans le sitemap (résultats) pendant 180 jours après leur début. */
export const SITEMAP_TOURNAMENT_DAYS = 180;
const DAY_MS = 24 * 60 * 60_000;
const SEALED_CARD_TYPES = ["Sealed", "Lot"];

type Entry = MetadataRoute.Sitemap[number];

/** Une entrée par langue, chacune déclarant toutes les versions comme alternatives. */
function localized(key: PublicRouteKey, params: Record<string, string> = {}, lastModified?: Date): Entry[] {
  const languages = Object.fromEntries(LOCALES.map((locale) => [locale, absoluteUrl(localizedPath(key, locale, params))]));
  return LOCALES.map((locale) => ({
    url: absoluteUrl(localizedPath(key, locale, params)),
    ...(lastModified ? { lastModified } : {}),
    alternates: { languages },
  }));
}

function latest(dates: Date[]): Date {
  return dates.reduce((max, date) => (date > max ? date : max));
}

/** Toutes les pages publiques indexables, avec leurs versions linguistiques et leur date de modification. */
export async function buildSitemap(now = new Date()): Promise<MetadataRoute.Sitemap> {
  const since = new Date(now.getTime() - SITEMAP_TOURNAMENT_DAYS * DAY_MS);
  const [cards, shops, tournaments] = await Promise.all([
    prisma.card.findMany({
      where: { isActive: true, OR: [{ cardType: null }, { cardType: { notIn: SEALED_CARD_TYPES } }] },
      select: { slug: true, updatedAt: true, printings: { where: { isActive: true }, select: { updatedAt: true, set: { select: { code: true } } } } },
      orderBy: { slug: "asc" },
    }),
    prisma.shop.findMany({ where: { status: { not: "rejected" } }, select: { slug: true, updatedAt: true }, orderBy: { slug: "asc" } }),
    prisma.tournament.findMany({
      where: { visibility: "public", status: { not: "annule" }, startsAt: { gte: since } },
      select: { id: true, updatedAt: true },
      orderBy: { startsAt: "asc" },
    }),
  ]);

  const staticPages: PublicRouteKey[] = ["home", "cards", "legalNotice", "terms", "privacy"];
  return [
    ...staticPages.flatMap((key) => localized(key)),
    ...cards
      .filter((card) => card.printings.some((printing) => !isSealedSetCode(printing.set.code)))
      .flatMap((card) => localized("card", { slug: card.slug }, latest([card.updatedAt, ...card.printings.map((p) => p.updatedAt)]))),
    ...shops.flatMap((shop) => localized("shop", { slug: shop.slug }, shop.updatedAt)),
    ...tournaments.flatMap((t) => localized("tournament", { id: t.id }, t.updatedAt)),
  ];
}
