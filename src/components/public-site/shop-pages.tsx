// Boutiques : fiche dans chaque langue (/boutiques/[slug], /en/shops/[slug]…), annuaire affiché
// sur l'accueil des visiteurs et sur /boutiques pour les comptes connectés.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ShopDirectory } from "@/components/shops/ShopDirectory";
import { ShopPage } from "@/components/shops/ShopPage";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { JsonLd } from "@/components/site/JsonLd";
import type { SearchParams } from "@/components/public-site/tournament-pages";
import { shopDirectoryQuerySchema, validateSearchParams } from "@/lib/api-schemas";
import { pageMetadata } from "@/lib/seo/metadata";
import { storeLd, tournamentListLd } from "@/lib/seo/structured-data";
import { findPublicShop, listPublicShops, toDetail } from "@/lib/shops/shops";
import { shopTournaments } from "@/lib/tournament/directory";
import type { Locale } from "@/i18n/config";
import { localizedPath } from "@/i18n/paths";
import { translatorFor } from "@/i18n/server";

// Métadonnées et page lisent la même boutique : une seule requête par rendu.
const findShop = cache(findPublicShop);

/** Premier rendu côté serveur de l'annuaire des boutiques. */
export async function initialShopDirectory(raw: Record<string, string | string[] | undefined>) {
  const params = Object.fromEntries(
    Object.entries(raw).flatMap(([key, value]) => {
      const first = Array.isArray(value) ? value[0] : value;
      return first ? [[key, first.slice(0, 120)]] : [];
    }),
  ) as Record<string, string>;
  const query = new URLSearchParams(params);
  query.delete("place");
  query.delete("view");
  const parsed = validateSearchParams(shopDirectoryQuerySchema, query);
  const initial = parsed.ok ? await listPublicShops(parsed.data) : null;
  return { params, initial };
}

/** Annuaire complet, réservé aux comptes connectés (les visiteurs le voient sur l'accueil). */
export async function ShopsDirectory({ searchParams }: { searchParams: SearchParams }) {
  const { params, initial } = await initialShopDirectory(await searchParams);
  return <ShopDirectory initialParams={params} initial={initial} />;
}

export async function shopMetadata(locale: Locale, slug: string): Promise<Metadata> {
  const shop = await findShop(slug);
  const t = await translatorFor(locale, "shops");
  if (!shop) return { title: t("seo.crumb"), robots: { index: false, follow: false } };
  return pageMetadata({
    locale,
    page: { key: "shop", params: { slug } },
    title: t("seo.itemTitle", { name: shop.name, city: shop.city }),
    description: shop.description?.trim() || t("seo.itemDescription", { name: shop.name, city: shop.city }),
    image: { url: `/og/shop/${encodeURIComponent(slug)}/${locale}`, width: 1200, height: 630, alt: shop.name },
  });
}

export async function ShopDetailPage({ locale, slug }: { locale: Locale; slug: string }) {
  const shop = await findShop(slug);
  if (!shop) notFound();
  const detail = toDetail(shop);
  const { upcoming, past } = await shopTournaments(shop.id);
  return (
    <>
      <Breadcrumbs
        locale={locale}
        items={[{ name: detail.name, path: localizedPath("shop", locale, { slug }) }]}
      />
      <JsonLd data={[storeLd(detail, locale), tournamentListLd(upcoming, locale)]} />
      <ShopPage shop={detail} upcoming={upcoming} past={past} />
    </>
  );
}
