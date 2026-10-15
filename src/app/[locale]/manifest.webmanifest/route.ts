import type { MetadataRoute } from "next";
import { isLocale, LOCALES } from "@/i18n/config";
import { formatRoute } from "@/i18n/match";
import { translatorFor } from "@/i18n/server";
import { SITE } from "@/lib/site";

/** Un manifeste par langue (« /de/manifest.webmanifest ») : textes et raccourcis dans la langue de la page. */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

const ICON = "/icons/icon-192.png?v=2";

export async function GET(_request: Request, context: RouteContext<"/[locale]/manifest.webmanifest">) {
  const { locale } = await context.params;
  if (!isLocale(locale)) return new Response(null, { status: 404 });
  const [nav, site] = await Promise.all([translatorFor(locale, "nav"), translatorFor(locale, "site")]);
  const manifest: MetadataRoute.Manifest = {
    // Identifiant commun aux langues : l'application installée reste la même si la langue change.
    id: "/",
    name: SITE.name,
    short_name: SITE.name,
    description: site("og.tagline"),
    start_url: formatRoute("/", locale),
    scope: "/",
    display: "standalone",
    background_color: "#07080d",
    theme_color: "#07080d",
    lang: locale,
    // Appui long sur l'icône (Android) : accès direct aux écrans principaux.
    shortcuts: [
      { name: nav("cards"), url: formatRoute("/cards", locale), icons: [{ src: ICON, sizes: "192x192" }] },
      { name: nav("investment"), url: formatRoute("/investissement", locale), icons: [{ src: ICON, sizes: "192x192" }] },
    ],
    // `?v=` force Android (serveur WebAPK de Google) à recharger les icônes : à incrémenter quand elles changent.
    icons: [
      { src: ICON, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return Response.json(manifest, { headers: { "content-type": "application/manifest+json" } });
}
