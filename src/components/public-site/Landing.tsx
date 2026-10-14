// Page d'accueil des visiteurs (/ sans session, /en) : rendue côté serveur, contenu indexable. Seule page
// publique de premier niveau : elle intègre les annuaires des tournois et des boutiques. Style inspiré
// des interfaces de Cyberpunk 2077 (classes .cp-* dans globals.css).

import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { PublicDirectory } from "@/components/public/PublicDirectory";
import { FeatureShowcase } from "@/components/public-site/FeatureShowcase";
import { GlitchDirector } from "@/components/public-site/GlitchDirector";
import { HeroCardFan } from "@/components/public-site/HeroCardFan";
import { LandingActions } from "@/components/public-site/LandingActions";
import { LandingFinder } from "@/components/public-site/LandingFinder";
import { RevealDirector } from "@/components/public-site/RevealDirector";
import { initialShopDirectory } from "@/components/public-site/shop-pages";
import { initialTournamentDirectory } from "@/components/public-site/tournament-pages";
import { ShopDirectory } from "@/components/shops/ShopDirectory";
import { JsonLd } from "@/components/site/JsonLd";
import { loadPublicCards } from "@/lib/seo/catalog-data";
import { colorLabel, COPY, typeLabel } from "@/lib/seo/copy";
import { HOME_COPY, pageMetadata } from "@/lib/seo/metadata";
import { LANDING_SECTIONS, localizedPath, type SiteLocale } from "@/lib/seo/routes";
import { itemListLd, organizationLd, tournamentListLd, webApplicationLd, websiteLd } from "@/lib/seo/structured-data";

export function landingMetadata(locale: SiteLocale): Metadata {
  return pageMetadata({
    locale,
    page: { key: "home" },
    title: HOME_COPY[locale].title,
    absoluteTitle: true,
    description: HOME_COPY[locale].description,
  });
}

/** Destination de chaque module : liste des cartes, section de cette page, ou inscription pour l'application. */
const FEATURE_TARGET: Record<string, "cards" | "tournaments" | "shops" | "register"> = {
  cards: "cards",
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

/**
 * Liseré vertical sur le bord de l'écran, comme les interfaces du jeu vidéo. D'une section à l'autre,
 * il alterne de côté : rouge à gauche, cyan à droite. Il se trace à l'apparition de la section.
 */
function EdgeBar({ side, color }: { side: "left" | "right"; color: string }) {
  return (
    <div
      aria-hidden="true"
      data-reveal="bar"
      className={`pointer-events-none absolute top-0 bottom-0 hidden w-1 md:block ${side === "left" ? "left-0" : "right-0"}`}
      style={{ background: color }}
    />
  );
}

/**
 * Apparition au chargement, en CSS seul (data-intro, cf. globals.css) : réservée au haut de page, qui
 * ne doit pas attendre le JavaScript pour s'afficher (LCP).
 */
function intro(delay = 0, kind: "up" | "left" = "up") {
  return { "data-intro": kind, style: { "--reveal-delay": `${delay}ms` } as CSSProperties };
}

/** Attributs d'apparition au défilement (RevealDirector), avec un décalage en millisecondes. */
function reveal(delay = 0, kind: "up" | "left" | "right" | "fade" | "wipe" = "up") {
  return { "data-reveal": kind, style: { "--reveal-delay": `${delay}ms` } as CSSProperties };
}

export async function Landing({ locale }: { locale: SiteLocale }) {
  const copy = COPY[locale].landing;
  const sections = LANDING_SECTIONS[locale];
  const [cards, tournaments, shops] = await Promise.all([loadPublicCards(locale), initialTournamentDirectory({}), initialShopDirectory({})]);
  const legends = cards.filter((card) => card.cardType === "Legend" && card.thumb);
  const money = new Intl.NumberFormat(COPY[locale].intl, { style: "currency", currency: "EUR" });
  const fan = legends.slice(0, 5).map((card) => ({
    slug: card.slug,
    name: card.name,
    href: localizedPath("card", locale, { slug: card.slug }),
    thumb: card.thumb!,
    alt: COPY[locale].card.imageAlt(card.name),
    kind: [typeLabel(locale, card.cardType), colorLabel(locale, card.color)].filter(Boolean).join(" · "),
    color: card.color,
    cost: card.cost,
    power: card.power,
    ram: card.ram,
    rules: card.rulesText,
    price: card.marketPrice ? money.format(Number(card.marketPrice)) : null,
    printingId: card.mainPrintingId,
  }));
  // Carte du module « Catalogue » : une vraie Unité, avec son prix si possible.
  const sample = cards.find((card) => card.cardType === "Unit" && card.thumb && card.marketPrice) ?? cards.find((card) => card.thumb);
  const features = copy.features.map((feature) => {
    const target = FEATURE_TARGET[feature.key] ?? "register";
    const href =
      target === "register" ? "/connexion?mode=register" : target === "cards" ? localizedPath("cards", locale) : `#${sections[target]}`;
    return { ...feature, href, external: target === "register" };
  });

  return (
    <div className="flex flex-col">
      <RevealDirector />
      <GlitchDirector />
      <JsonLd
        data={[
          websiteLd(locale),
          organizationLd(),
          webApplicationLd(locale, HOME_COPY[locale].description, copy.features.map((feature) => feature.title)),
          tournamentListLd(tournaments.initial?.tournaments ?? [], locale),
          itemListLd((shops.initial?.shops ?? []).map((shop) => ({ name: shop.name, path: localizedPath("shop", locale, { slug: shop.slug }) }))),
        ]}
      />
      <section className="relative overflow-hidden border-b border-line">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-60" style={gridStyle} />
        <EdgeBar side="left" color="var(--cp-red)" />
        <div className="relative mx-auto grid w-full max-w-[1100px] items-center gap-10 px-3 py-12 sm:px-4 md:grid-cols-[1.05fr_1fr] md:py-20">
          <div className="flex flex-col gap-6">
            <div {...intro(0, "left")} className="self-start">
              <p className="cp-index cp-glitch" data-text={`// ${copy.eyebrow}`} data-glitch="hero-eyebrow">
                {`// ${copy.eyebrow}`}
              </p>
            </div>
            <div {...intro(60)}>
              <h1
                className="cp-glitch font-display text-3xl font-bold uppercase leading-[1.05] tracking-wide text-yellow sm:text-5xl"
                data-text={copy.title}
                data-glitch="hero-title"
              >
                {copy.title}
              </h1>
            </div>
            <p {...intro(160)} className="max-w-xl border-l-2 border-cyan/60 pl-4 text-base leading-7 text-muted">
              {copy.lead}
            </p>
            <div {...intro(260)} className="flex flex-wrap gap-3">
              <LandingActions register={copy.register} openApp={copy.openApp} />
            </div>
          </div>
          {/* Pas d'apparition au défilement : l'éventail a sa propre arrivée (donne des cartes). */}
          {fan.length ? (
            <HeroCardFan
              cards={fan}
              labels={{
                list: copy.fanLabel,
                close: copy.cardClose,
                track: COPY[locale].card.addToCollection,
                price: COPY[locale].card.marketPrice,
              }}
            />
          ) : null}
        </div>
      </section>

      <section className="relative">
        <EdgeBar side="right" color="var(--cyan)" />
        {/* Titre passé au carrousel : il reste épinglé avec lui pendant le défilement des modules. */}
        <FeatureShowcase
          header={
            <div className="mb-8 flex flex-col gap-2">
              <p {...reveal(0, "left")} className="cp-index">
                {"01 // "}
                {copy.modulesLabel}
              </p>
              <div {...reveal(120)} className="self-start">
                <h2
                  className="cp-glitch font-display text-3xl font-bold uppercase tracking-wide text-yellow sm:text-4xl"
                  data-text={copy.featuresTitle}
                  data-glitch="modules-title"
                >
                  {copy.featuresTitle}
                </h2>
              </div>
            </div>
          }
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

      <section id={sections.tournaments} className="relative scroll-mt-2 border-t border-line pt-16">
        <EdgeBar side="left" color="var(--cp-red)" />
        <div className="mx-auto mb-8 flex w-full max-w-[1100px] flex-col gap-2 px-3 sm:px-4">
          <p {...reveal(0, "left")} className="cp-index">
            {"02 // "}
            {copy.findLabel}
          </p>
          <div {...reveal(120)} className="self-start">
            <h2
              className="cp-glitch font-display text-3xl font-bold uppercase tracking-wide text-yellow sm:text-4xl"
              data-text={copy.findTitle}
              data-glitch="find-title"
            >
              {copy.findTitle}
            </h2>
          </div>
          <p {...reveal(240)} className="max-w-2xl text-sm text-muted">
            {copy.findBody}
          </p>
        </div>
        <div {...reveal(300, "fade")}>
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
        </div>
      </section>

      {/* Bandeau final jaune plein, la couleur d'interface du jeu vidéo ; il se déploie de gauche à droite. */}
      <section {...reveal(0, "wipe")} className="cp-on-yellow bg-yellow text-black">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col items-start gap-5 px-3 py-14 sm:px-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <h2 className="cp-glitch self-start font-display text-3xl font-bold uppercase tracking-wide" data-text={copy.finalTitle} data-glitch="final-title">
              {copy.finalTitle}
            </h2>
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
