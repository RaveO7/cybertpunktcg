import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { languageAlternates, localizedPath, type PublicRouteKey, type SiteLocale } from "@/lib/seo/routes";
import { siteUrl } from "@/lib/seo/site";

export type { SiteLocale };

export const BRAND = SITE.name;

export const DESCRIPTION_MAX = 160;
export const TITLE_MAX = 70;

/** Titre et description de l'accueil, repris comme valeurs par défaut de chaque racine. */
export const HOME_COPY: Record<SiteLocale, { title: string; description: string }> = {
  fr: {
    title: "TCG Tracker — Cartes, collection et tournois Cyberpunk TCG",
    description:
      "Toutes les cartes Cyberpunk TCG, le suivi de votre collection et de sa valeur, vos decks, et les tournois et boutiques près de chez vous. Gratuit.",
  },
  en: {
    title: "TCG Tracker — Cyberpunk TCG card list, collection and tournaments",
    description:
      "Browse every Cyberpunk TCG card, track your collection and its value, build decks and find tournaments and game stores near you. Free.",
  },
};

const OG_LOCALE: Record<SiteLocale, string> = { fr: "fr_FR", en: "en_US" };

export type ShareImage = { url: string; width: number; height: number; alt: string };

/** Image de partage par défaut (1200×630) d'une langue. */
export function defaultShareImage(locale: SiteLocale): ShareImage {
  return { url: `/og/${locale}`, width: 1200, height: 630, alt: HOME_COPY[locale].title };
}

/** Description d'au plus 160 caractères, coupée sur une limite de mot. */
export function truncateDescription(text: string, max = DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut).replace(/[\s,;:.—-]+$/, "")}…`;
}

/**
 * Titre de 70 caractères au plus : suffixe de marque ajouté seulement s'il tient, titre coupé sur
 * une limite de mot sinon.
 */
export function fitTitle(title: string, absolute = false): { title: string; withBrand: boolean } {
  const clean = title.replace(/\s+/g, " ").trim();
  if (!absolute && `${clean} · ${BRAND}`.length <= TITLE_MAX) return { title: clean, withBrand: true };
  return { title: truncateDescription(clean, TITLE_MAX), withBrand: false };
}

/** Métadonnées communes d'une mise en page racine (fr ou en). */
export function rootMetadata(locale: SiteLocale): Metadata {
  const home = HOME_COPY[locale];
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: home.title, template: `%s · ${BRAND}` },
    description: home.description,
    applicationName: BRAND,
    icons: { apple: "/icons/apple-icon.png" },
    appleWebApp: {
      capable: true,
      title: BRAND,
      statusBarStyle: "black",
    },
    openGraph: {
      siteName: BRAND,
      locale: OG_LOCALE[locale],
      type: "website",
      images: [defaultShareImage(locale)],
    },
    twitter: { card: "summary_large_image", images: [defaultShareImage(locale).url] },
  };
}

type PageTarget = { key: PublicRouteKey; params?: Record<string, string> } | { path: string };

/**
 * Métadonnées d'une page publique : titre, description, canonique sans query, hreflang,
 * Open Graph et Twitter. `absoluteTitle` évite le suffixe de marque (accueil).
 */
export function pageMetadata(options: {
  locale: SiteLocale;
  page: PageTarget;
  title: string;
  absoluteTitle?: boolean;
  description: string;
  image?: ShareImage;
  type?: "website" | "article";
  noindex?: boolean;
}): Metadata {
  const { locale, page } = options;
  const { title, withBrand } = fitTitle(options.title, options.absoluteTitle);
  const description = truncateDescription(options.description);
  const canonical = "key" in page ? localizedPath(page.key, locale, page.params) : page.path;
  const languages = "key" in page ? languageAlternates(page.key, page.params) : undefined;
  const image = options.image ?? defaultShareImage(locale);
  const fullTitle = withBrand ? `${title} · ${BRAND}` : title;
  return {
    title: withBrand ? title : { absolute: title },
    description,
    alternates: { canonical, ...(languages ? { languages } : {}) },
    openGraph: {
      title: fullTitle,
      description,
      url: canonical,
      siteName: BRAND,
      locale: OG_LOCALE[locale],
      ...(languages ? { alternateLocale: [OG_LOCALE[locale === "fr" ? "en" : "fr"]] } : {}),
      type: options.type ?? "website",
      images: [image],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [image.url] },
    ...(options.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée. */
export const privateMetadata: Metadata = { robots: { index: false, follow: false } };
