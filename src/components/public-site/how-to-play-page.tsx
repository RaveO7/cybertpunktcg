import type { Metadata } from "next";
import Link from "next/link";
import { HowToPlayGate } from "@/components/public-site/HowToPlayGate";
import { loadPublicCards } from "@/lib/seo/catalog-data";
import { COPY, typePlural } from "@/lib/seo/copy";
import { pageMetadata } from "@/lib/seo/metadata";
import { TYPE_KEYS } from "@/lib/seo/public-catalog";
import { localizedPath, type SiteLocale } from "@/lib/seo/routes";

export function howToPlayMetadata(locale: SiteLocale): Metadata {
  const copy = COPY[locale].howToPlay;
  return pageMetadata({ locale, page: { key: "howToPlay" }, title: copy.metaTitle, description: copy.metaDescription });
}

const primary = "inline-flex h-12 items-center bg-yellow px-5 text-sm font-semibold text-black hover:brightness-110";
const secondary = "inline-flex h-12 items-center border border-cyan px-5 text-sm text-cyan hover:bg-cyan/10";
const sectionTitle = "font-display text-xl uppercase tracking-wide text-yellow";

/** Présentation du jeu pour les visiteurs : donner envie, puis inviter à se connecter pour jouer. */
async function HowToPlayTeaser({ locale }: { locale: SiteLocale }) {
  const copy = COPY[locale].howToPlay.teaser;
  const cards = await loadPublicCards(locale);
  // Une illustration réelle par type de carte.
  const sample = new Map(TYPE_KEYS.map((type) => [type, cards.find((card) => card.cardType === type && card.thumb)]));
  const next = localizedPath("howToPlay", locale);
  const auth = (mode: "register" | "login") => `/connexion?mode=${mode}&next=${encodeURIComponent(next)}`;
  const actions = (
    <div className="flex flex-wrap gap-3">
      <Link href={auth("register")} rel="nofollow" className={primary}>
        {copy.register}
      </Link>
      <Link href={auth("login")} rel="nofollow" className={secondary}>
        {copy.login}
      </Link>
    </div>
  );

  return (
    <div className="flex flex-col">
      <section className="border-b border-line">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-10 md:py-14">
          <p className="font-mono text-xs tracking-[0.18em] text-cyan">{copy.eyebrow.toUpperCase()}</p>
          <h1 className="font-display text-3xl font-bold uppercase leading-tight tracking-wide text-yellow sm:text-4xl">{copy.title}</h1>
          <p className="max-w-3xl text-base text-muted">{copy.lead}</p>
          {actions}
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-4 py-10">
        <section className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex flex-col gap-3">
            <h2 className={sectionTitle}>{copy.goalTitle}</h2>
            <p className="text-sm leading-6 text-muted">{copy.goalBody}</p>
            <p className="text-sm text-foreground">{copy.diceNote}</p>
          </div>
          <ul className="grid grid-cols-6 gap-2 md:grid-cols-3" aria-hidden="true">
            {copy.dice.map((die) => (
              <li key={die} className="hud-panel grid aspect-square min-w-12 place-items-center font-mono text-sm text-cyan md:min-w-16">
                {die}
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className={sectionTitle}>{copy.cardsTitle}</h2>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-5 lg:grid-cols-4">
            {copy.cards.map((item) => {
              const card = sample.get(item.type as (typeof TYPE_KEYS)[number]);
              return (
                <li key={item.type} className="group relative flex flex-col gap-3">
                  {card?.thumb ? (
                    <Link
                      href={localizedPath("card", locale, { slug: card.slug })}
                      className="hud-panel relative block aspect-card overflow-hidden bg-overlay scanlines scanbeam"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- miniatures pré-générées */}
                      <img
                        src={card.thumb}
                        alt={COPY[locale].card.imageAlt(card.name)}
                        width={400}
                        height={559}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </Link>
                  ) : null}
                  <div className="flex flex-col gap-1">
                    <h3 className="text-base font-semibold text-foreground">{typePlural(locale, item.type)}</h3>
                    <p className="text-sm leading-6 text-muted">{item.body}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className={sectionTitle}>{copy.turnTitle}</h2>
          <ol className="grid gap-3 md:grid-cols-3">
            {copy.turn.map((step, index) => (
              <li key={step.title} className="hud-panel flex flex-col gap-1 p-4">
                <span className="font-mono text-xs text-cyan">0{index + 1}</span>
                <h3 className="text-base font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm leading-6 text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h2 className={sectionTitle}>{copy.fightTitle}</h2>
            {copy.fightBody.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-6 text-muted">
                {paragraph}
              </p>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <h2 className={sectionTitle}>{copy.deckTitle}</h2>
            <p className="text-sm leading-6 text-muted">{copy.deckBody}</p>
            <Link href={localizedPath("cards", locale)} className="text-sm text-cyan underline">
              {copy.browseCards} →
            </Link>
          </div>
        </section>
      </div>

      <section className="border-t border-line">
        <div className="mx-auto w-full max-w-5xl px-4 py-10">
          <div className="flex flex-col items-start gap-3 border border-yellow/60 bg-panel p-6">
            <h2 className={sectionTitle}>{copy.ctaTitle}</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted">{copy.ctaBody}</p>
            {actions}
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * « Comment jouer », public (/comment-jouer, /en/how-to-play) : présentation pour les visiteurs,
 * règles complètes et parcours interactif une fois connecté.
 */
export function HowToPlayPage({ locale }: { locale: SiteLocale }) {
  return <HowToPlayGate teaser={<HowToPlayTeaser locale={locale} />} />;
}
