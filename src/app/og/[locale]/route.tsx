import { defaultOgImage, isSiteLocale } from "@/lib/seo/og-image";

export async function GET(_request: Request, { params }: RouteContext<"/og/[locale]">) {
  const { locale } = await params;
  if (!isSiteLocale(locale)) return new Response("Not found", { status: 404 });
  return defaultOgImage(locale);
}
