import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { COPY } from "@/lib/seo/copy";
import { isSiteLocale, ogImage } from "@/lib/seo/og-image";
import { findPublicShop } from "@/lib/shops/shops";

/** Image de partage d'une boutique : nom, ville et logo (converti en PNG pour le moteur de rendu). */
export async function GET(_request: Request, { params }: RouteContext<"/og/shop/[slug]/[locale]">) {
  const { slug, locale } = await params;
  if (!isSiteLocale(locale)) return new Response("Not found", { status: 404 });
  const shop = await findPublicShop(slug);
  if (!shop) return new Response("Not found", { status: 404 });
  const row = await prisma.shop.findUnique({ where: { id: shop.id }, select: { logo: true } });
  let logo: string | null = null;
  if (row?.logo) {
    try {
      const png = await sharp(Buffer.from(row.logo)).resize(220, 220).png().toBuffer();
      logo = `data:image/png;base64,${png.toString("base64")}`;
    } catch {
      logo = null;
    }
  }
  return ogImage({
    eyebrow: COPY[locale].og.shop,
    title: shop.name,
    lines: [[shop.city, shop.region].filter(Boolean).join(", ")],
    logo,
  });
}
