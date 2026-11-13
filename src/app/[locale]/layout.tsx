import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getLocale } from "next-intl/server";
import { SiteShell } from "@/components/site/SiteShell";
import { siteViewport } from "@/components/site/viewport";
import { LOCALES } from "@/i18n/config";
import { routing } from "@/i18n/routing";
import { rootMetadata } from "@/lib/seo/metadata";
import "../globals.css";

export const viewport = siteViewport;

// Chaque page existe dans chaque langue du registre (sous /<code>, français compris : /fr).
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata() {
  return rootMetadata(await getLocale());
}

export default async function RootLayout({ children, preload, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return (
    <SiteShell lang={locale} head={preload}>
      {children}
    </SiteShell>
  );
}
