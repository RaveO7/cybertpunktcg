// Pages publiques des boutiques, partagées par /boutiques (fr) et /en/shops (en).

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ShopDirectory } from "@/components/shops/ShopDirectory";
import { ShopPage } from "@/components/shops/ShopPage";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { JsonLd } from "@/components/site/JsonLd";
import type { SearchParams } from "@/components/public-site/tournament-pages";
import { shopDirectoryQuerySchema, validateSearchParams } from "@/lib/api-schemas";
import { COPY } from "@/lib/seo/copy";
import { pageMetadata } from "@/lib/seo/metadata";
import { localizedPath, type SiteLocale } from "@/lib/seo/routes";
import { itemListLd, storeLd, tournamentListLd } from "@/lib/seo/structured-data";
import { findPublicShop, listPublicShops, toDetail } from "@/lib/shops/shops";
import { shopTournaments } from "@/lib/tournament/directory";

// Métadonnées et page lisent la même boutique : une seule requête par rendu.
const findShop = cache(findPublicShop);

export function shopsDirectoryMetadata(locale: SiteLocale): Metadata {
  const copy = COPY[locale].shops;
  return pageMetadata({ locale, page: { key: "shops" }, title: copy.metaTitle, description: copy.metaDescription });
}

export async function ShopsDirectory({ locale, searchParams }: { locale: SiteLocale; searchParams: SearchParams }) {
  const raw = await searchParams;
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
  return (
    <>
      <Breadcrumbs locale={locale} items={[{ name: COPY[locale].shops.crumb, path: localizedPath("shops", locale) }]} />
      <JsonLd
        data={[itemListLd((initial?.shops ?? []).map((shop) => ({ name: shop.name, path: localizedPath("shop", locale, { slug: shop.slug }) })))]}
      />
      <ShopDirectory initialParams={params} initial={initial} />
    </>
  );
}

export async function shopMetadata(locale: SiteLocale, slug: string): Promise<Metadata> {
  const shop = await findShop(slug);
  if (!shop) return { title: COPY[locale].shops.crumb, robots: { index: false, follow: false } };
  const copy = COPY[locale].shops;
  return pageMetadata({
    locale,
    page: { key: "shop", params: { slug } },
    title: copy.itemTitle(shop.name, shop.city),
    description: shop.description?.trim() || copy.itemDescription(shop.name, shop.city),
    image: { url: `/og/shop/${encodeURIComponent(slug)}/${locale}`, width: 1200, height: 630, alt: shop.name },
  });
}

export async function ShopDetailPage({ locale, slug }: { locale: SiteLocale; slug: string }) {
  const shop = await findShop(slug);
  if (!shop) notFound();
  const detail = toDetail(shop);
  const { upcoming, past } = await shopTournaments(shop.id);
  return (
    <>
      <Breadcrumbs
        locale={locale}
        items={[
          { name: COPY[locale].shops.crumb, path: localizedPath("shops", locale) },
          { name: detail.name, path: localizedPath("shop", locale, { slug }) },
        ]}
      />
      <JsonLd data={[storeLd(detail, locale), tournamentListLd(upcoming, locale)]} />
      <ShopPage shop={detail} upcoming={upcoming} past={past} />
    </>
  );
}
