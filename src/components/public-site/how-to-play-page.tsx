import type { Metadata } from "next";
import { HowToPlayScreen } from "@/components/HowToPlayScreen";
import { COPY } from "@/lib/seo/copy";
import { pageMetadata } from "@/lib/seo/metadata";
import type { SiteLocale } from "@/lib/seo/routes";

export function howToPlayMetadata(locale: SiteLocale): Metadata {
  const copy = COPY[locale].howToPlay;
  return pageMetadata({ locale, page: { key: "howToPlay" }, title: copy.metaTitle, description: copy.metaDescription });
}

/** Tutoriel « Comment jouer », public (/comment-jouer, /en/how-to-play). */
export function HowToPlayPage() {
  return (
    <div className="flex h-0 min-h-0 flex-1 flex-col overflow-hidden">
      <HowToPlayScreen />
    </div>
  );
}
