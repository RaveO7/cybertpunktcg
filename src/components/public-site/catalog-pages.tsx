// Liste et fiches publiques des cartes, partagées par /cartes (fr) et /en/cards (en). Rendu serveur, sans JS requis.

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { TrackCardLink } from "@/components/public-site/TrackCardLink";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { JsonLd } from "@/components/site/JsonLd";
import { latestPriceDate, loadPublicCards } from "@/lib/seo/catalog-data";
import { CARD_TYPES, colorLabel, COPY, typeLabel, typePlural } from "@/lib/seo/copy";
import { pageMetadata } from "@/lib/seo/metadata";
import { cardWithNeighbours, type PublicCard } from "@/lib/seo/public-catalog";
import { localizedPath, type SiteLocale } from "@/lib/seo/routes";
import { cardLd, itemListLd } from "@/lib/seo/structured-data";

const IMAGE = { width: 733, height: 1024 };
const THUMB = { width: 400, height: 559 };

const actionClass = "inline-flex h-11 items-center border border-cyan px-4 text-sm text-cyan hover:bg-cyan/10";

/** Texte de règles : les mots-clés entre accolades ({Call}, {Go Solo}) en gras. */
function RulesText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, lineIndex) => (
        <p key={lineIndex} className="mt-1 first:mt-0">
          {line.split(/(\{[^}]+\})/).map((part, index) =>
            /^\{[^}]+\}$/.test(part) ? (
              <strong key={index} className="text-foreground">
                {part.slice(1, -1)}
              </strong>
            ) : (
              <Fragment key={index}>{part}</Fragment>
            ),
          )}
        </p>
      ))}
    </>
  );
}

function plainRules(text: string | null) {
  return text ? text.replace(/[{}]/g, "").replace(/\s+/g, " ").trim() : null;
}

function cardFacts(card: PublicCard, locale: SiteLocale) {
  const copy = COPY[locale].card;
  // « Légende (Rouge) » : évite l'accord de l'adjectif de couleur avec le type.
  const color = colorLabel(locale, card.color);
  const kind = [typeLabel(locale, card.cardType), color ? `(${color})` : null].filter(Boolean).join(" ");
  const stats = [
    card.cost !== null ? `${copy.cost.toLowerCase()} ${card.cost}` : null,
    card.power !== null ? `${copy.power.toLowerCase()} ${card.power}` : null,
    card.ram !== null ? `RAM ${card.ram}` : null,
  ].filter(Boolean);
  return [kind, ...stats].filter(Boolean).join(", ");
}

function formatPrice(value: string, locale: SiteLocale) {
  return new Intl.NumberFormat(COPY[locale].intl, { style: "currency", currency: "EUR" }).format(Number(value));
}

function formatDate(iso: string, locale: SiteLocale) {
  return new Intl.DateTimeFormat(COPY[locale].intl, { dateStyle: "long" }).format(new Date(iso));
}

/**
 * Tuile de carte reprenant celle de l'explorateur : halo aux couleurs de l'illustration, balayage et
 * zoom au survol (effets réservés à la souris, cf. globals.css).
 */
function CardTile({ card, locale, eager = false }: { card: PublicCard; locale: SiteLocale; eager?: boolean }) {
  return (
    <li className="group relative">
      {card.thumb ? (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 aspect-card" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- halo décoratif, même miniature que la tuile */}
            <img src={card.thumb} alt="" loading="lazy" decoding="async" className="card-ambilight" />
          </div>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] aspect-card overflow-visible" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- halo décoratif, même miniature que la tuile */}
            <img src={card.thumb} alt="" loading="lazy" decoding="async" className="card-ambilight card-ambilight-bottom" />
          </div>
        </>
      ) : null}
      <Link
        href={localizedPath("card", locale, { slug: card.slug })}
        className="hud-panel relative z-0 flex h-full flex-col overflow-hidden transition-colors hover:border-cyan/70 focus-visible:border-cyan"
      >
        <div className="relative aspect-card overflow-hidden bg-overlay scanlines scanbeam">
          {card.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element -- miniatures pré-générées (aucune optimisation Vercel)
            <img
              src={card.thumb}
              alt={COPY[locale].card.imageAlt(card.name)}
              width={THUMB.width}
              height={THUMB.height}
              loading={eager ? "eager" : "lazy"}
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : null}
        </div>
        <p className="truncate p-2 text-xs font-bold text-foreground">{card.name}</p>
      </Link>
    </li>
  );
}

/** Ancre d'une section de type (« legendes », « units ») : nom au pluriel, sans accents. */
function sectionId(label: string) {
  return label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function catalogMetadata(locale: SiteLocale): Promise<Metadata> {
  const copy = COPY[locale].catalog;
  const count = (await loadPublicCards(locale)).length;
  return pageMetadata({ locale, page: { key: "cards" }, title: copy.metaTitle, description: copy.metaDescription(count) });
}

/**
 * Liste de toutes les cartes, une section par type : relie chaque fiche à deux clics de l'accueil
 * (lien du pied de page). Pas de filtres en query : une seule URL à indexer.
 */
export async function CatalogPage({ locale }: { locale: SiteLocale }) {
  const copy = COPY[locale].catalog;
  const cards = await loadPublicCards(locale);
  const known = new Set<string>(CARD_TYPES);
  const groups = [
    ...CARD_TYPES.map((type) => ({ label: typePlural(locale, type), cards: cards.filter((card) => card.cardType === type) })),
    { label: copy.other, cards: cards.filter((card) => !card.cardType || !known.has(card.cardType)) },
  ].filter((group) => group.cards.length > 0);

  return (
    <div className="flex flex-col">
      <Breadcrumbs locale={locale} items={[{ name: COPY[locale].nav.cards, path: localizedPath("cards", locale) }]} />
      <JsonLd data={[itemListLd(cards.map((card) => ({ name: card.name, path: localizedPath("card", locale, { slug: card.slug }) })))]} />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-5">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex max-w-3xl min-w-0 flex-col gap-2">
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-yellow sm:text-3xl">{copy.title}</h1>
            <p className="text-sm leading-6 text-muted">{copy.intro(cards.length)}</p>
          </div>
          <TrackCardLink label={copy.track} className={actionClass} />
        </header>
        <nav aria-label={copy.sections}>
          <ul className="flex flex-wrap gap-2 text-sm">
            {groups.map((group) => (
              <li key={group.label}>
                <a href={`#${sectionId(group.label)}`} className="inline-flex items-center gap-2 border border-line px-3 py-1.5 text-muted hover:border-cyan hover:text-foreground">
                  {group.label}
                  <span className="font-mono text-xs text-cyan">{group.cards.length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        {groups.map((group, groupIndex) => (
          <section key={group.label} id={sectionId(group.label)} className="flex scroll-mt-4 flex-col gap-3">
            <h2 className="font-display text-lg uppercase tracking-wide text-yellow">
              {group.label} <span className="font-mono text-sm text-muted">({group.cards.length})</span>
            </h2>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
              {group.cards.map((card, index) => (
                <CardTile key={card.slug} card={card} locale={locale} eager={groupIndex === 0 && index < 6} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export async function cardStaticParams() {
  return (await loadPublicCards("en")).map((card) => ({ slug: card.slug }));
}

export async function cardMetadata(locale: SiteLocale, slug: string): Promise<Metadata> {
  const card = (await loadPublicCards(locale)).find((entry) => entry.slug === slug);
  if (!card) return { robots: { index: false, follow: false } };
  const copy = COPY[locale].card;
  const image = card.image
    ? { url: card.image, width: IMAGE.width, height: IMAGE.height, alt: copy.imageAlt(card.name) }
    : undefined;
  return pageMetadata({
    locale,
    page: { key: "card", params: { slug } },
    title: copy.metaTitle(card.name),
    description: copy.metaDescription(card.name, cardFacts(card, locale), plainRules(card.rulesText)),
    image,
    type: "article",
  });
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div className="flex flex-col gap-0.5 border border-line px-3 py-2">
      <dt className="hud-label">{label}</dt>
      <dd className="font-display text-lg text-foreground">{value}</dd>
    </div>
  );
}

export async function CardPage({ locale, slug }: { locale: SiteLocale; slug: string }) {
  const [cards, priceDate] = await Promise.all([loadPublicCards(locale), latestPriceDate()]);
  const found = cardWithNeighbours(cards, slug);
  if (!found) notFound();
  const { card, previous, next, sameColor } = found;
  const copy = COPY[locale].card;
  const color = colorLabel(locale, card.color);

  return (
    <div className="flex flex-col">
      <Breadcrumbs
        locale={locale}
        items={[
          { name: COPY[locale].nav.cards, path: localizedPath("cards", locale) },
          { name: card.name, path: localizedPath("card", locale, { slug }) },
        ]}
      />
      <JsonLd
        data={[cardLd({ name: card.name, slug: card.slug, description: plainRules(card.rulesText), image: card.image, artist: card.artist }, locale)]}
      />
      <article className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-5">
        <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
          {card.image ? (
            // eslint-disable-next-line @next/next/no-img-element -- image locale déjà optimisée (WebP)
            <img
              src={card.image}
              alt={copy.imageAlt(card.name)}
              width={IMAGE.width}
              height={IMAGE.height}
              fetchPriority="high"
              className="mx-auto h-auto w-full max-w-[320px] border border-line"
            />
          ) : null}
          <div className="flex min-w-0 flex-col gap-4">
            <header className="flex flex-col gap-1">
              <p className="font-mono text-xs tracking-[0.18em] text-cyan">
                {[typeLabel(locale, card.cardType), color].filter(Boolean).join(" · ")}
              </p>
              <h1 className="font-display text-2xl font-bold uppercase leading-tight tracking-wide text-yellow sm:text-3xl">{card.name}</h1>
            </header>
            <dl className="grid grid-cols-3 gap-2 sm:max-w-sm">
              <Fact label={copy.cost} value={card.cost} />
              <Fact label={copy.power} value={card.power} />
              <Fact label={copy.ram} value={card.ram} />
            </dl>
            {card.rulesText ? (
              <section>
                <h2 className="hud-label">{copy.rules}</h2>
                <div className="mt-1 text-sm text-muted">
                  <RulesText text={card.rulesText} />
                </div>
              </section>
            ) : null}
            {card.flavorText ? (
              <section>
                <h2 className="hud-label">{copy.flavor}</h2>
                <p className="mt-1 text-sm italic text-muted">{card.flavorText}</p>
              </section>
            ) : null}
            {!card.translated && copy.untranslated ? <p className="text-xs text-muted">{copy.untranslated}</p> : null}
            {card.tags.length || card.keywords.length ? (
              <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                {card.tags.length ? (
                  <div>
                    <dt className="hud-label">{copy.tags}</dt>
                    <dd>{card.tags.join(", ")}</dd>
                  </div>
                ) : null}
                {card.keywords.length ? (
                  <div>
                    <dt className="hud-label">{copy.keywords}</dt>
                    <dd>{card.keywords.join(", ")}</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            {card.marketPrice ? (
              <section className="border border-line p-3">
                <h2 className="hud-label">{copy.marketPrice}</h2>
                <p className="font-display text-2xl text-yellow">{formatPrice(card.marketPrice, locale)}</p>
                {priceDate ? <p className="text-xs text-muted">{copy.priceAsOf(formatDate(priceDate, locale))}</p> : null}
              </section>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <TrackCardLink printingId={card.mainPrintingId} label={copy.addToCollection} className={actionClass} />
              <Link href={localizedPath("cards", locale)} className="inline-flex h-11 items-center border border-line px-4 text-sm text-muted hover:border-cyan hover:text-foreground">
                {copy.backToList}
              </Link>
            </div>
          </div>
        </div>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg uppercase tracking-wide text-yellow">{copy.printings}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th className="py-2 pr-3 font-normal">{copy.set}</th>
                  <th className="py-2 pr-3 font-normal">{copy.number}</th>
                  <th className="py-2 pr-3 font-normal">{copy.rarity}</th>
                  <th className="py-2 pr-3 font-normal">{copy.language}</th>
                  <th className="py-2 pr-3 font-normal">{copy.artist}</th>
                  <th className="py-2 text-right font-normal">{copy.price}</th>
                </tr>
              </thead>
              <tbody>
                {card.printings.map((printing) => (
                  <tr key={printing.id} className="border-b border-line/60">
                    <td className="py-2 pr-3">{printing.setName}</td>
                    <td className="py-2 pr-3 font-mono">{printing.collectorNumber}</td>
                    <td className="py-2 pr-3">{printing.rarity ?? "—"}</td>
                    <td className="py-2 pr-3 uppercase">{printing.language}</td>
                    <td className="py-2 pr-3">{printing.artist ?? "—"}</td>
                    <td className="py-2 text-right font-mono">{printing.marketPrice ? formatPrice(printing.marketPrice, locale) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <nav className="flex flex-wrap justify-between gap-3 text-sm" aria-label={`${copy.previous} / ${copy.next}`}>
          {previous ? (
            <Link href={localizedPath("card", locale, { slug: previous.slug })} rel="prev" className="text-cyan underline">
              ← {copy.previous} : {previous.name}
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={localizedPath("card", locale, { slug: next.slug })} rel="next" className="text-cyan underline">
              {copy.next} : {next.name} →
            </Link>
          ) : null}
        </nav>

        {sameColor.length && color ? (
          <section className="flex flex-col gap-3">
            <h2 className="font-display text-lg uppercase tracking-wide text-yellow">{copy.sameColor(color)}</h2>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {sameColor.map((other) => (
                <CardTile key={other.slug} card={other} locale={locale} />
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </div>
  );
}
