// Page d'accueil des visiteurs (/ sans session, /en) : rendue côté serveur, contenu indexable. Seule page
// publique de premier niveau : elle intègre les annuaires des tournois et des boutiques.

import type { Metadata } from "next";
import Link from "next/link";
import { PublicDirectory } from "@/components/public/PublicDirectory";
import { LandingActions } from "@/components/public-site/LandingActions";
import { initialShopDirectory } from "@/components/public-site/shop-pages";
import { initialTournamentDirectory } from "@/components/public-site/tournament-pages";
import { ShopDirectory } from "@/components/shops/ShopDirectory";
import { JsonLd } from "@/components/site/JsonLd";
import { loadPublicCards } from "@/lib/seo/catalog-data";
import { COPY } from "@/lib/seo/copy";
import { HOME_COPY, pageMetadata } from "@/lib/seo/metadata";
import { LANDING_SECTIONS, localizedPath, type SiteLocale } from "@/lib/seo/routes";
import { itemListLd, organizationLd, tournamentListLd, websiteLd } from "@/lib/seo/structured-data";

export function landingMetadata(locale: SiteLocale): Metadata {
  return pageMetadata({
    locale,
    page: { key: "home" },
    title: HOME_COPY[locale].title,
    absoluteTitle: true,
    description: HOME_COPY[locale].description,
  });
}

/** Destination de chaque bloc de fonctionnalité : section de cette page, ou inscription pour l'application. */
const FEATURE_TARGET: Record<string, "tournaments" | "shops" | "register"> = {
  cards: "register",
  collection: "register",
  decks: "register",
  tournaments: "tournaments",
  shops: "shops",
  howToPlay: "register",
};

export async function Landing({ locale }: { locale: SiteLocale }) {
  const copy = COPY[locale].landing;
  const sections = LANDING_SECTIONS[locale];
  const [cards, tournaments, shops] = await Promise.all([loadPublicCards(locale), initialTournamentDirectory({}), initialShopDirectory({})]);
  const featured = cards.filter((card) => card.cardType === "Legend" && card.thumb).slice(0, 4);

  return (
    <div className="flex flex-col">
      <JsonLd
        data={[
          websiteLd(locale),
          organizationLd(),
          tournamentListLd(tournaments.initial?.tournaments ?? [], locale),
          itemListLd((shops.initial?.shops ?? []).map((shop) => ({ name: shop.name, path: localizedPath("shop", locale, { slug: shop.slug }) }))),
        ]}
      />
      <section className="border-b border-line">
        <div className="mx-auto grid w-full max-w-5xl items-center gap-8 px-4 py-10 md:grid-cols-[1.2fr_1fr] md:py-14">
          <div className="flex flex-col gap-4">
            <p className="font-mono text-xs tracking-[0.18em] text-cyan">{copy.eyebrow}</p>
            <h1 className="font-display text-3xl font-bold uppercase leading-tight tracking-wide text-yellow sm:text-4xl">{copy.title}</h1>
            <p className="text-base text-muted">{copy.lead}</p>
            <div className="flex flex-wrap gap-3">
              <LandingActions register={copy.register} login={copy.login} openApp={copy.openApp} />
            </div>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <a href={`#${sections.tournaments}`} className="text-cyan underline">
                {copy.seeTournaments} ↓
              </a>
              <a href={`#${sections.shops}`} className="text-cyan underline">
                {copy.seeShops} ↓
              </a>
            </p>
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
            const target = FEATURE_TARGET[feature.key] ?? "register";
            const href = target === "register" ? "/connexion?mode=register" : `#${sections[target]}`;
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

      <section id={sections.tournaments} className="scroll-mt-2 border-t border-line">
        <PublicDirectory initialParams={tournaments.params} initial={tournaments.initial} embedded />
      </section>

      <section id={sections.shops} className="scroll-mt-2 border-t border-line">
        <ShopDirectory initialParams={shops.params} initial={shops.initial} embedded />
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
