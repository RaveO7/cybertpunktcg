// Page d'accueil des visiteurs (/ sans session, /en) : rendue côté serveur, contenu indexable. Seule page
// publique de premier niveau : elle intègre les annuaires des tournois et des boutiques. Style inspiré
// des interfaces de Cyberpunk 2077 (classes .cp-* dans globals.css).

import type { Metadata } from "next";
import { PublicDirectory } from "@/components/public/PublicDirectory";
import { FeatureShowcase } from "@/components/public-site/FeatureShowcase";
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

/** Destination de chaque module : section de cette page, ou inscription pour l'application. */
const FEATURE_TARGET: Record<string, "tournaments" | "shops" | "register"> = {
  cards: "register",
  collection: "register",
  decks: "register",
  tournaments: "tournaments",
  shops: "shops",
  howToPlay: "register",
};

/** Trame HUD discrète. */
const gridStyle = {
  backgroundImage: "linear-gradient(var(--hud-border) 1px, transparent 1px), linear-gradient(90deg, var(--hud-border) 1px, transparent 1px)",
  backgroundSize: "48px 48px",
  maskImage: "radial-gradient(ellipse 60% 70% at 72% 50%, black, transparent)",
  WebkitMaskImage: "radial-gradient(ellipse 60% 70% at 72% 50%, black, transparent)",
};

export async function Landing({ locale }: { locale: SiteLocale }) {
  const copy = COPY[locale].landing;
  const sections = LANDING_SECTIONS[locale];
  const [cards, tournaments, shops] = await Promise.all([loadPublicCards(locale), initialTournamentDirectory({}), initialShopDirectory({})]);
  const legends = cards.filter((card) => card.cardType === "Legend" && card.thumb);
  const fan = legends.slice(0, 5).map((card) => ({
    slug: card.slug,
    name: card.name,
    href: localizedPath("card", locale, { slug: card.slug }),
    thumb: card.thumb!,
    alt: COPY[locale].card.imageAlt(card.name),
  }));
  // Carte du module « Catalogue » : une vraie Unité, avec son prix si possible.
  const sample = cards.find((card) => card.cardType === "Unit" && card.thumb && card.marketPrice) ?? cards.find((card) => card.thumb);
  const money = new Intl.NumberFormat(COPY[locale].intl, { style: "currency", currency: "EUR" });
  const features = copy.features.map((feature) => {
    const target = FEATURE_TARGET[feature.key] ?? "register";
    return { ...feature, href: target === "register" ? "/connexion?mode=register" : `#${sections[target]}`, external: target === "register" };
  });

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
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-60" style={gridStyle} />
        {/* Liseré rouge sur le bord, comme les écrans du jeu vidéo. */}
        <div aria-hidden="true" className="pointer-events-none absolute top-0 bottom-0 left-0 hidden w-1 md:block" style={{ background: "var(--cp-red)" }} />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-[1.05fr_1fr] md:py-20">
          <div className="flex flex-col gap-6">
            <p className="cp-index">{"// "}{copy.eyebrow}</p>
            <h1 className="cp-glitch font-display text-3xl font-bold uppercase leading-[1.05] tracking-wide text-yellow sm:text-5xl" data-text={copy.title}>
              {copy.title}
            </h1>
            <p className="max-w-xl border-l-2 border-cyan/60 pl-4 text-base leading-7 text-muted">{copy.lead}</p>
            <div className="flex flex-wrap gap-3">
              <LandingActions register={copy.register} openApp={copy.openApp} />
            </div>
          </div>
          {fan.length ? <HeroCardFan cards={fan} label={copy.fanLabel} /> : null}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1100px] px-3 sm:px-4 py-16">
        <div className="mb-8 flex flex-col gap-2">
          <p className="cp-index">{"01 // "}{copy.modulesLabel}</p>
          <h2 className="font-display text-3xl font-bold uppercase tracking-wide text-yellow sm:text-4xl">{copy.featuresTitle}</h2>
        </div>
        <FeatureShowcase
          features={features}
          labels={{ preview: copy.preview, example: copy.example, open: copy.open }}
          data={{
            locale,
            legends: legends.slice(0, 3).map((card) => ({ name: card.name, thumb: card.thumb! })),
            sample: sample?.thumb
              ? {
                  name: sample.name,
                  thumb: sample.thumb,
                  cost: sample.cost,
                  power: sample.power,
                  ram: sample.ram,
                  price: sample.marketPrice ? money.format(Number(sample.marketPrice)) : null,
                }
              : null,
            totalCards: cards.length,
          }}
        />
      </section>

      <section id={sections.tournaments} className="scroll-mt-2 border-t border-line pt-16">
        <div className="mx-auto mb-8 flex w-full max-w-[1100px] flex-col gap-2 px-3 sm:px-4">
          <p className="cp-index">{"02 // "}{copy.findLabel}</p>
          <h2 className="font-display text-3xl font-bold uppercase tracking-wide text-yellow sm:text-4xl">{copy.findTitle}</h2>
          <p className="max-w-2xl text-sm text-muted">{copy.findBody}</p>
        </div>
        <LandingFinder
          tabs={{
            tournaments: {
              id: sections.tournaments,
              label: copy.tabTournaments,
              count: tournaments.initial?.total ?? null,
              panel: <PublicDirectory initialParams={tournaments.params} initial={tournaments.initial} embedded />,
            },
            shops: {
              id: sections.shops,
              label: copy.tabShops,
              count: shops.initial?.total ?? null,
              panel: <ShopDirectory initialParams={shops.params} initial={shops.initial} embedded />,
            },
          }}
        />
      </section>

      {/* Bandeau final jaune plein, la couleur d'interface du jeu vidéo. */}
      <section className="cp-on-yellow bg-yellow text-black">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-5 px-4 py-14 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="font-display text-3xl font-bold uppercase tracking-wide">{copy.finalTitle}</h2>
            <p className="max-w-xl text-sm">{copy.finalBody}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <LandingActions register={copy.register} login={copy.login} openApp={copy.openApp} />
          </div>
        </div>
      </section>
    </div>
  );
}
