// Page d'accueil des visiteurs (/ sans session, /en) : rendue côté serveur, contenu indexable. Seule page
// publique de premier niveau : elle intègre les annuaires des tournois et des boutiques. Style inspiré
// des interfaces de Cyberpunk 2077 (classes .cp-* dans globals.css).

import { getFormatter, getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";
import { PublicDirectory } from "@/components/public/PublicDirectory";
import { FeatureShowcase, type ShowcaseFeature, type ShowcaseText } from "@/components/public-site/FeatureShowcase";
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
import { cardLabels } from "@/lib/seo/card-labels";
import { homeCopy } from "@/lib/seo/metadata";
import { itemListLd, organizationLd, tournamentListLd, webApplicationLd, websiteLd } from "@/lib/seo/structured-data";
import type { Locale } from "@/i18n/config";
import { localizedPath, routePath } from "@/i18n/paths";
import { landingSections } from "@/i18n/routing";

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

export async function Landing({ locale }: { locale: Locale }) {
  const sections = landingSections[locale];
  const [t, tCard, labels, format, home, cards, tournaments, shops] = await Promise.all([
    getTranslations({ locale, namespace: "landing" }),
    getTranslations({ locale, namespace: "card" }),
    cardLabels(locale),
    getFormatter({ locale }),
    homeCopy(locale),
    loadPublicCards(locale),
    initialTournamentDirectory({}),
    initialShopDirectory({}),
  ]);
  const featureCopy = t.raw("features") as Omit<ShowcaseFeature, "href" | "external">[];
  const legends = cards.filter((card) => card.cardType === "Legend" && card.thumb);
  const money = (value: number) => format.number(value, { style: "currency", currency: "EUR" });
  const fan = legends.slice(0, 5).map((card) => ({
    slug: card.slug,
    name: card.name,
    href: localizedPath("card", locale, { slug: card.slug }),
    thumb: card.thumb!,
    alt: tCard("imageAlt", { name: card.name }),
    kind: [labels.type(card.cardType), labels.color(card.color)].filter(Boolean).join(" · "),
    color: card.color,
    cost: card.cost,
    power: card.power,
    ram: card.ram,
    rules: card.rulesText,
    price: card.marketPrice ? money(Number(card.marketPrice)) : null,
    printingId: card.mainPrintingId,
  }));
  // Carte du module « Catalogue » : une vraie Unité, avec son prix si possible.
  const sample = cards.find((card) => card.cardType === "Unit" && card.thumb && card.marketPrice) ?? cards.find((card) => card.thumb);
  const features = featureCopy.map((feature) => {
    const target = FEATURE_TARGET[feature.key] ?? "register";
    const href =
      target === "register" ? `${routePath("/connexion", locale)}?mode=register` : target === "cards" ? localizedPath("cards", locale) : `#${sections[target]}`;
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
          webApplicationLd(locale, home.description, featureCopy.map((feature) => feature.title)),
          tournamentListLd(tournaments.initial?.tournaments ?? [], locale),
          itemListLd((shops.initial?.shops ?? []).map((shop) => ({ name: shop.name, path: localizedPath("shop", locale, { slug: shop.slug }) }))),
        ]}
      />
      <section className="relative overflow-hidden border-b border-line">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-60" style={gridStyle} />
        <EdgeBar side="left" color="var(--cp-red)" />
        <div className="relative mx-auto grid w-full max-w-[1100px] items-center gap-12 px-3 py-16 sm:px-4 md:grid-cols-[1.05fr_1fr] md:py-24">
          <div className="flex flex-col gap-8">
            <div {...intro(0, "left")} className="self-start">
              <p className="cp-index cp-glitch" data-text={`// ${t("eyebrow")}`} data-glitch="hero-eyebrow">
                {`// ${t("eyebrow")}`}
              </p>
            </div>
            <div {...intro(60)}>
              <h1
                className="cp-glitch font-display text-3xl font-bold uppercase leading-[1.05] tracking-wide text-yellow sm:text-5xl"
                data-text={t("title")}
                data-glitch="hero-title"
              >
                {t("title")}
              </h1>
            </div>
            <p {...intro(160)} className="max-w-xl border-l-2 border-cyan/60 pl-4 text-base leading-7 text-muted">
              {t("lead")}
            </p>
            <div {...intro(260)} className="flex flex-wrap gap-3">
              <LandingActions register={t("register")} openApp={t("openApp")} />
            </div>
          </div>
          {/* Pas d'apparition au défilement : l'éventail a sa propre arrivée (donne des cartes). */}
          {fan.length ? (
            <HeroCardFan
              cards={fan}
              labels={{
                list: t("fanLabel"),
                close: t("cardClose"),
                track: tCard("addToCollection"),
                price: tCard("marketPrice"),
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
            <div className="mb-12 flex flex-col gap-3">
              <p {...reveal(0, "left")} className="cp-index">
                {"01 // "}
                {t("modulesLabel")}
              </p>
              <div {...reveal(120)} className="self-start">
                <h2
                  className="cp-glitch font-display text-3xl font-bold uppercase tracking-wide text-yellow sm:text-4xl"
                  data-text={t("featuresTitle")}
                  data-glitch="modules-title"
                >
                  {t("featuresTitle")}
                </h2>
              </div>
            </div>
          }
          features={features}
          labels={{ preview: t("preview"), example: t("example"), open: t("open") }}
          data={{
            text: t.raw("showcase") as ShowcaseText,
            missingCost: money(7.8),
            legends: legends.slice(0, 3).map((card) => ({ name: card.name, thumb: card.thumb! })),
            sample: sample?.thumb
              ? {
                  name: sample.name,
                  thumb: sample.thumb,
                  cost: sample.cost,
                  power: sample.power,
                  ram: sample.ram,
                  price: sample.marketPrice ? money(Number(sample.marketPrice)) : null,
                }
              : null,
            totalCards: cards.length,
          }}
        />
      </section>

      <section id={sections.tournaments} className="relative scroll-mt-2 border-t border-line py-20">
        <EdgeBar side="left" color="var(--cp-red)" />
        <div className="mx-auto mb-12 flex w-full max-w-[1100px] flex-col gap-3 px-3 sm:px-4">
          <p {...reveal(0, "left")} className="cp-index">
            {"02 // "}
            {t("findLabel")}
          </p>
          <div {...reveal(120)} className="self-start">
            <h2
              className="cp-glitch font-display text-3xl font-bold uppercase tracking-wide text-yellow sm:text-4xl"
              data-text={t("findTitle")}
              data-glitch="find-title"
            >
              {t("findTitle")}
            </h2>
          </div>
          <p {...reveal(240)} className="max-w-2xl text-sm text-muted">
            {t("findBody")}
          </p>
        </div>
        <div {...reveal(300, "fade")}>
          <LandingFinder
            tabs={{
              tournaments: {
                id: sections.tournaments,
                label: t("tabTournaments"),
                count: tournaments.initial?.total ?? null,
                panel: <PublicDirectory initialParams={tournaments.params} initial={tournaments.initial} embedded />,
              },
              shops: {
                id: sections.shops,
                label: t("tabShops"),
                count: shops.initial?.total ?? null,
                panel: <ShopDirectory initialParams={shops.params} initial={shops.initial} embedded />,
              },
            }}
          />
        </div>
      </section>

      {/* Bandeau final jaune plein, la couleur d'interface du jeu vidéo ; il se déploie de gauche à droite. */}
      <section {...reveal(0, "wipe")} className="cp-on-yellow bg-yellow text-black">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col items-start gap-4 px-3 py-7 sm:px-4 md:flex-row md:items-center md:justify-between md:gap-8">
          <div className="flex min-w-0 flex-col gap-2">
            <h2 className="cp-glitch self-start font-display text-3xl font-bold uppercase tracking-wide" data-text={t("finalTitle")} data-glitch="final-title">
              {t("finalTitle")}
            </h2>
            <p className="max-w-xl text-sm">{t("finalBody")}</p>
          </div>
          <div className="flex flex-wrap gap-3 md:shrink-0 md:flex-nowrap">
            <LandingActions register={t("register")} login={t("login")} openApp={t("openApp")} />
          </div>
        </div>
      </section>
    </div>
  );
}
