// Page d'accueil des visiteurs (/ sans session, /en) : rendue côté serveur, contenu indexable.

import type { Metadata } from "next";
import Link from "next/link";
import { formatStart } from "@/components/public/format";
import { LandingActions } from "@/components/public-site/LandingActions";
import { JsonLd } from "@/components/site/JsonLd";
import { loadPublicCards } from "@/lib/seo/catalog-data";
import { COPY } from "@/lib/seo/copy";
import { HOME_COPY, pageMetadata } from "@/lib/seo/metadata";
import { localizedPath, type PublicRouteKey, type SiteLocale } from "@/lib/seo/routes";
import { organizationLd, websiteLd } from "@/lib/seo/structured-data";
import { searchPublicTournaments } from "@/lib/tournament/directory";

export function landingMetadata(locale: SiteLocale): Metadata {
  return pageMetadata({
    locale,
    page: { key: "home" },
    title: HOME_COPY[locale].title,
    absoluteTitle: true,
    description: HOME_COPY[locale].description,
  });
}

/** Destination de chaque bloc de fonctionnalité (pages publiques, ou inscription pour l'application). */
const FEATURE_TARGET: Record<string, PublicRouteKey | "register"> = {
  cards: "cards",
  collection: "register",
  decks: "register",
  tournaments: "tournaments",
  shops: "shops",
  howToPlay: "howToPlay",
};

export async function Landing({ locale }: { locale: SiteLocale }) {
  const copy = COPY[locale].landing;
  const [cards, directory] = await Promise.all([loadPublicCards(locale), searchPublicTournaments({ sort: "date" })]);
  const upcoming = directory.tournaments.slice(0, 3);
  const featured = cards.filter((card) => card.cardType === "Legend" && card.thumb).slice(0, 4);

  return (
    <div className="flex flex-col">
      <JsonLd data={[websiteLd(locale), organizationLd()]} />
      <section className="border-b border-line">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-8 px-4 py-10 md:grid-cols-[1.2fr_1fr] md:py-14">
          <div className="flex flex-col gap-4">
            <p className="font-mono text-xs tracking-[0.18em] text-cyan">{copy.eyebrow}</p>
            <h1 className="font-display text-3xl font-bold uppercase leading-tight tracking-wide text-yellow sm:text-4xl">{copy.title}</h1>
            <p className="text-base text-muted">{copy.lead}</p>
            <div className="flex flex-wrap gap-3">
              <LandingActions register={copy.register} login={copy.login} openApp={copy.openApp} />
            </div>
            <Link href={localizedPath("cards", locale)} className="text-sm text-cyan underline">
              {copy.browseCards} — {copy.cardsCount(cards.length)} →
            </Link>
          </div>
          {featured.length ? (
            <ul className="grid grid-cols-4 gap-2 md:grid-cols-2" aria-label={COPY[locale].nav.cards}>
              {featured.map((card, index) => (
                <li key={card.slug}>
                  <Link href={localizedPath("card", locale, { slug: card.slug })}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- miniatures pré-générées */}
                    <img
                      src={card.thumb!}
                      alt={COPY[locale].card.imageAlt(card.name)}
                      width={400}
                      height={559}
                      loading={index < 2 ? "eager" : "lazy"}
                      className="h-auto w-full border border-line"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-10">
        <h2 className="font-display text-xl uppercase tracking-wide text-yellow">{copy.featuresTitle}</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {copy.features.map((feature) => {
            const target = FEATURE_TARGET[feature.key];
            const href = target === "register" ? "/connexion?mode=register" : localizedPath(target, locale);
            return (
              <li key={feature.key}>
                <Link
                  href={href}
                  rel={target === "register" ? "nofollow" : undefined}
                  className="flex h-full flex-col gap-1 border border-line bg-panel p-4 transition hover:border-cyan"
                >
                  <h3 className="text-base text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted">{feature.body}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pb-10">
        <h2 className="font-display text-xl uppercase tracking-wide text-yellow">{copy.upcomingTitle}</h2>
        {upcoming.length ? (
          <ul className="mt-4 flex flex-col gap-2">
            {upcoming.map((t) => (
              <li key={t.id}>
                <Link
                  href={localizedPath("tournament", locale, { id: t.id })}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border border-line p-3 hover:border-cyan"
                >
                  <span className="text-foreground">{t.name}</span>
                  <span className="text-sm text-muted">
                    {[formatStart(t.startsAt, t.timeZone, locale), t.city, t.shop?.name].filter(Boolean).join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">{copy.upcomingEmpty}</p>
        )}
        <Link href={localizedPath("tournaments", locale)} className="mt-3 inline-block text-sm text-cyan underline">
          {copy.upcomingAll} →
        </Link>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-3 px-4 py-10">
          <h2 className="font-display text-xl uppercase tracking-wide text-yellow">{copy.finalTitle}</h2>
          <p className="text-sm text-muted">{copy.finalBody}</p>
          <div className="flex flex-wrap gap-3">
            <LandingActions register={copy.register} login={copy.login} openApp={copy.openApp} />
          </div>
        </div>
      </section>
    </div>
  );
}
