import type { Metadata } from "next";
import { LOCALES, OG_LOCALE, type Locale } from "@/i18n/config";
import { languageAlternates, localizedPath, type PublicRouteKey } from "@/i18n/paths";
import { translatorFor } from "@/i18n/server";
import { siteUrl } from "@/lib/seo/site";
import { SITE } from "@/lib/site";

export const BRAND = SITE.name;

export const DESCRIPTION_MAX = 160;
export const TITLE_MAX = 70;

export type ShareImage = { url: string; width: number; height: number; alt: string };

/** Titre et description de l'accueil d'une langue, repris comme valeurs par défaut de chaque page. */
export async function homeCopy(locale: Locale): Promise<{ title: string; description: string }> {
  const t = await translatorFor(locale, "site");
  return { title: t("home.title"), description: t("home.description") };
}

/** Image de partage par défaut (1200×630) d'une langue. */
export async function defaultShareImage(locale: Locale): Promise<ShareImage> {
  return { url: `/og/${locale}`, width: 1200, height: 630, alt: (await homeCopy(locale)).title };
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

/** Métadonnées communes de toutes les pages d'une langue (mise en page racine). */
export async function rootMetadata(locale: Locale): Promise<Metadata> {
  const home = await homeCopy(locale);
  const image = await defaultShareImage(locale);
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: home.title, template: `%s · ${BRAND}` },
    description: home.description,
    applicationName: BRAND,
    manifest: `/${locale}/manifest.webmanifest`,
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
      images: [image],
    },
    twitter: { card: "summary_large_image", images: [image.url] },
  };
}

type PageTarget = { key: PublicRouteKey; params?: Record<string, string> } | { path: string };

/**
 * Métadonnées d'une page publique : titre, description, canonique sans query, hreflang,
 * Open Graph et Twitter. `absoluteTitle` évite le suffixe de marque (accueil).
 */
export async function pageMetadata(options: {
  locale: Locale;
  page: PageTarget;
  title: string;
  absoluteTitle?: boolean;
  description: string;
  image?: ShareImage;
  type?: "website" | "article";
  noindex?: boolean;
}): Promise<Metadata> {
  const { locale, page } = options;
  const { title, withBrand } = fitTitle(options.title, options.absoluteTitle);
  const description = truncateDescription(options.description);
  const canonical = "key" in page ? localizedPath(page.key, locale, page.params) : page.path;
  const languages = "key" in page ? languageAlternates(page.key, page.params) : undefined;
  const image = options.image ?? (await defaultShareImage(locale));
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
      ...(languages ? { alternateLocale: LOCALES.filter((other) => other !== locale).map((other) => OG_LOCALE[other]) } : {}),
      type: options.type ?? "website",
      images: [image],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [image.url] },
    ...(options.noindex ? { robots: { index: false, follow: true } } : {}),
  };
}

/** Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée. */
export const privateMetadata: Metadata = { robots: { index: false, follow: false } };
