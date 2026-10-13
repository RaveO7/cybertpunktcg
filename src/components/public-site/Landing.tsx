// Page d'accueil des visiteurs (/ sans session, /en) : rendue côté serveur, contenu indexable. Seule page
// publique de premier niveau : elle intègre les annuaires des tournois et des boutiques.

import type { Metadata } from "next";
import Link from "next/link";
import { PublicDirectory } from "@/components/public/PublicDirectory";
import { HeroCardFan } from "@/components/public-site/HeroCardFan";
import { LandingActions } from "@/components/public-site/LandingActions";
import { LandingFinder } from "@/components/public-site/LandingFinder";
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
  const fan = cards
    .filter((card) => card.cardType === "Legend" && card.thumb)
    .slice(0, 5)
    .map((card) => ({
      slug: card.slug,
      name: card.name,
      href: localizedPath("card", locale, { slug: card.slug }),
      thumb: card.thumb!,
      alt: COPY[locale].card.imageAlt(card.name),
    }));
  const tournamentCount = tournaments.initial?.total ?? null;
  const shopCount = shops.initial?.total ?? null;
  const open = copy.features.filter((feature) => FEATURE_TARGET[feature.key] !== "register" && FEATURE_TARGET[feature.key]);
  const withAccount = copy.features.filter((feature) => (FEATURE_TARGET[feature.key] ?? "register") === "register");

  const featureList = (title: string, features: typeof copy.features) => (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-cyan">{title}</h3>
      <ul className="flex flex-col">
        {features.map((feature) => {
          const target = FEATURE_TARGET[feature.key] ?? "register";
          const href = target === "register" ? "/connexion?mode=register" : `#${sections[target]}`;
          return (
            <li key={feature.key}>
              <Link
                href={href}
                rel={target === "register" ? "nofollow" : undefined}
                className="group flex flex-col gap-1 border-l-2 border-line py-3 pl-4 transition-colors hover:border-yellow focus-visible:border-yellow"
              >
                <span className="text-base text-foreground group-hover:text-yellow">{feature.title}</span>
                <span className="text-sm leading-6 text-muted">{feature.body}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

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
      <section className="relative overflow-hidden border-b border-line">
        {/* Trame HUD discrète derrière l'éventail. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(var(--hud-border) 1px, transparent 1px), linear-gradient(90deg, var(--hud-border) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse 60% 70% at 72% 50%, black, transparent)",
            WebkitMaskImage: "radial-gradient(ellipse 60% 70% at 72% 50%, black, transparent)",
          }}
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[1.05fr_1fr] md:py-20">
          <div className="flex flex-col gap-5">
            <p className="text-sm text-cyan">{copy.eyebrow}</p>
            <h1 className="font-display text-3xl font-bold uppercase leading-[1.05] tracking-wide text-yellow sm:text-5xl">{copy.title}</h1>
            <p className="max-w-xl text-base leading-7 text-muted">{copy.lead}</p>
            <div className="flex flex-wrap gap-3">
              <LandingActions register={copy.register} login={copy.login} openApp={copy.openApp} />
            </div>
            <p className="flex flex-wrap gap-2 text-sm">
              {[
                { id: sections.tournaments, label: copy.seeTournaments, count: tournamentCount },
                { id: sections.shops, label: copy.seeShops, count: shopCount },
              ].map((link) => (
                <a
                  key={link.id}
                  href={`#${link.id}`}
                  className="inline-flex h-9 items-center gap-2 border border-line px-3 text-muted transition-colors hover:border-cyan hover:text-foreground"
                >
                  {link.label}
                  {link.count ? <span className="font-mono text-xs text-yellow">{link.count}</span> : null}
                </a>
              ))}
            </p>
          </div>
          {fan.length ? <HeroCardFan cards={fan} label={copy.fanLabel} /> : null}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-14">
        <h2 className="font-display text-2xl uppercase tracking-wide text-yellow">{copy.featuresTitle}</h2>
        <div className="mt-6 grid gap-10 md:grid-cols-2">
          {featureList(copy.openTitle, open)}
          {featureList(copy.accountTitle, withAccount)}
        </div>
      </section>

      <section id={sections.tournaments} className="scroll-mt-2 border-t border-line pt-12">
        <div className="mx-auto mb-6 flex w-full max-w-[1100px] flex-col gap-2 px-3 sm:px-4">
          <h2 className="font-display text-2xl uppercase tracking-wide text-yellow">{copy.findTitle}</h2>
          <p className="max-w-2xl text-sm text-muted">{copy.findBody}</p>
        </div>
        <LandingFinder
          tabs={{
            tournaments: {
              id: sections.tournaments,
              label: copy.tabTournaments,
              count: tournamentCount,
              panel: <PublicDirectory initialParams={tournaments.params} initial={tournaments.initial} embedded />,
            },
            shops: {
              id: sections.shops,
              label: copy.tabShops,
              count: shopCount,
              panel: <ShopDirectory initialParams={shops.params} initial={shops.initial} embedded />,
            },
          }}
        />
      </section>

      <section className="border-t border-line">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-3 px-4 py-14">
          <h2 className="font-display text-2xl uppercase tracking-wide text-yellow">{copy.finalTitle}</h2>
          <p className="max-w-xl text-sm text-muted">{copy.finalBody}</p>
          <div className="flex flex-wrap gap-3">
            <LandingActions register={copy.register} login={copy.login} openApp={copy.openApp} />
          </div>
        </div>
      </section>
    </div>
  );
}
