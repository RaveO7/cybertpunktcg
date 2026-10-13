// Catalogue public des cartes, partagé par /cartes (fr) et /en/cards (en). Rendu serveur, sans JS requis.

import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { TrackCardLink } from "@/components/public-site/TrackCardLink";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { JsonLd } from "@/components/site/JsonLd";
import { latestPriceDate, loadPublicCards } from "@/lib/seo/catalog-data";
import { colorLabel, COPY, typeLabel, typePlural } from "@/lib/seo/copy";
import { pageMetadata } from "@/lib/seo/metadata";
import { cardWithNeighbours, COLOR_KEYS, costValues, filterCards, TYPE_KEYS, type PublicCard } from "@/lib/seo/public-catalog";
import { localizedPath, type SiteLocale } from "@/lib/seo/routes";
import { breadcrumbLd, cardLd, itemListLd } from "@/lib/seo/structured-data";
import type { SearchParams } from "@/components/public-site/tournament-pages";

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

function readFilters(raw: Record<string, string | string[] | undefined>, costs: number[]) {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const color = first(raw.color);
  const type = first(raw.type);
  const cost = Number(first(raw.cost) ?? Number.NaN);
  const q = first(raw.q)?.trim().slice(0, 80);
  return {
    color: color && (COLOR_KEYS as readonly string[]).includes(color) ? color : undefined,
    type: type && (TYPE_KEYS as readonly string[]).includes(type) ? type : undefined,
    cost: costs.includes(cost) ? cost : undefined,
    q: q || undefined,
  };
}

export async function catalogMetadata(locale: SiteLocale): Promise<Metadata> {
  const copy = COPY[locale].catalog;
  const count = (await loadPublicCards(locale)).length;
  return pageMetadata({ locale, page: { key: "cards" }, title: copy.metaTitle, description: copy.metaDescription(count) });
}

/** Liseré de la puce de type, aux couleurs de la carte (comme dans l'explorateur). */
const CHIP_COLORS: Record<string, string> = {
  Red: "var(--cp-card-red)",
  Blue: "var(--cp-card-blue)",
  Green: "var(--cp-card-green)",
  Yellow: "var(--cp-card-yellow)",
};

const DOT_CLASSES: Record<string, string> = {
  Red: "bg-card-red",
  Blue: "bg-card-blue",
  Green: "bg-card-green",
  Yellow: "bg-card-yellow",
};

/**
 * Tuile de carte reprenant celle de l'explorateur : halo aux couleurs de l'illustration, balayage et
 * zoom au survol (effets réservés à la souris, cf. globals.css). `compact` n'affiche que le nom.
 */
function CardTile({
  card,
  locale,
  eager = false,
  compact = false,
}: {
  card: PublicCard;
  locale: SiteLocale;
  eager?: boolean;
  compact?: boolean;
}) {
  const stats = [
    { label: "COST", value: card.cost, dot: false },
    { label: "PWR", value: card.power, dot: false },
    { label: "RAM", value: card.ram, dot: true },
  ].filter((stat) => stat.value !== null);
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
        <div className={`flex flex-1 flex-col ${compact ? "p-2" : "p-2.5 sm:p-3"}`}>
          <p className={`truncate font-bold text-foreground ${compact ? "text-xs" : "text-sm"}`}>{card.name}</p>
          {!compact && card.cardType ? (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="chip-wrap" style={{ "--chip-color": CHIP_COLORS[card.color ?? ""] ?? "var(--cyan)" } as CSSProperties}>
                <span className="chip-cyber">{typeLabel(locale, card.cardType)}</span>
              </span>
            </div>
          ) : null}
          {!compact && stats.length ? (
            <div className="mt-auto flex flex-wrap gap-x-2 gap-y-1 pt-2">
              {stats.map((stat) => (
                <span key={stat.label} className="hud-label inline-flex items-center gap-1">
                  {stat.dot ? <span className={`h-2 w-2 rounded-full ${DOT_CLASSES[card.color ?? ""] ?? "bg-cyan"}`} /> : null}
                  <span className="opacity-80">{stat.label}</span>
                  <span className="text-foreground">{stat.value}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </Link>
    </li>
  );
}

type ActiveFilters = ReturnType<typeof readFilters>;

/** Panneau de filtres, à l'image de celui de l'explorateur. Des liens : fonctionne sans JS. */
function CatalogFilterPanel({
  locale,
  filters,
  costs,
  filterHref,
}: {
  locale: SiteLocale;
  filters: ActiveFilters;
  costs: number[];
  filterHref: (next: Partial<ActiveFilters>) => string;
}) {
  const copy = COPY[locale].catalog;
  const chip = (active: boolean) =>
    `inline-flex items-center gap-1.5 border px-2 py-1 text-xs ${
      active ? "border-yellow bg-yellow/10 text-yellow" : "border-line text-muted hover:border-cyan hover:text-foreground"
    }`;
  // Un filtre actif se désactive en cliquant à nouveau dessus, comme dans l'explorateur.
  const groups: { label: string; options: { key: string; label: ReactNode; active: boolean; href: string }[] }[] = [
    {
      label: copy.colorFilter,
      options: COLOR_KEYS.map((color) => ({
        key: color,
        label: (
          <>
            <span className={`h-2 w-2 rounded-full ${DOT_CLASSES[color]}`} aria-hidden="true" />
            {colorLabel(locale, color)}
          </>
        ),
        active: filters.color === color,
        href: filterHref({ ...filters, color: filters.color === color ? undefined : color }),
      })),
    },
    {
      label: copy.typeFilter,
      options: TYPE_KEYS.map((type) => ({
        key: type,
        label: typePlural(locale, type),
        active: filters.type === type,
        href: filterHref({ ...filters, type: filters.type === type ? undefined : type }),
      })),
    },
    {
      label: copy.costFilter,
      options: costs.map((cost) => ({
        key: String(cost),
        label: cost,
        active: filters.cost === cost,
        href: filterHref({ ...filters, cost: filters.cost === cost ? undefined : cost }),
      })),
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Link
        href={filterHref({})}
        rel="nofollow"
        className="flex h-10 w-full items-center justify-center border border-cyan text-sm text-cyan hover:bg-cyan/10"
      >
        {copy.reset}
      </Link>
      {groups.map((group) => (
        <fieldset key={group.label}>
          <legend className="mb-2 text-sm text-muted">{group.label}</legend>
          <div className="flex flex-wrap gap-1.5">
            {group.options.map((option) => (
              <Link
                key={option.key}
                href={option.href}
                rel="nofollow"
                aria-current={option.active ? "true" : undefined}
                className={chip(option.active)}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

export async function CatalogPage({ locale, searchParams }: { locale: SiteLocale; searchParams: SearchParams }) {
  const copy = COPY[locale].catalog;
  const all = await loadPublicCards(locale);
  const costs = costValues(all);
  const filters = readFilters(await searchParams, costs);
  const cards = filterCards(all, filters);
  const filterHref = (next: Partial<ActiveFilters>) => {
    const query = new URLSearchParams();
    if (next.q) query.set("q", next.q);
    if (next.color) query.set("color", next.color);
    if (next.type) query.set("type", next.type);
    if (next.cost !== undefined) query.set("cost", String(next.cost));
    return localizedPath("cards", locale, {}, query);
  };
  const activeCount = [filters.color, filters.type, filters.cost].filter((value) => value !== undefined).length;
  const panel = <CatalogFilterPanel locale={locale} filters={filters} costs={costs} filterHref={filterHref} />;

  return (
    <div className="mx-auto grid w-full max-w-[1600px] gap-6 px-4 py-4 lg:grid-cols-[280px_1fr]">
      {/* Fil d'Ariane : données structurées seulement, pas d'affichage sur cette page. */}
      <JsonLd
        data={[
          breadcrumbLd([
            { name: COPY[locale].breadcrumb.home, path: localizedPath("home", locale) },
            { name: COPY[locale].nav.cards, path: localizedPath("cards", locale) },
          ]),
          itemListLd(cards.map((card) => ({ name: card.name, path: localizedPath("card", locale, { slug: card.slug }) }))),
        ]}
      />
      <aside className="hidden lg:block" aria-label={copy.filters}>
        <div className="scrollbar-hud sticky top-0 max-h-[100cqh] overflow-y-auto pr-4 pb-4">
          <h2 className="mb-5 flex h-10 items-center text-sm font-medium">{copy.filters}</h2>
          {panel}
        </div>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-yellow sm:text-3xl">{copy.title}</h1>
            <p className="text-sm text-muted">{copy.intro(all.length)}</p>
          </div>
          <TrackCardLink label={copy.track} className={actionClass} />
        </header>
        <div className="mb-4 flex flex-col gap-2 lg:flex-row">
          {/* Téléphone et tablette : panneau repliable (sans JS) à la place du panneau latéral. */}
          <details className="lg:hidden">
            <summary className="flex h-10 cursor-pointer list-none items-center gap-2 border border-line px-3 text-sm text-cyan [&::-webkit-details-marker]:hidden">
              <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="square" />
              </svg>
              {copy.filters}
              {activeCount ? <span className="bg-yellow px-1.5 font-mono text-xs text-black">{activeCount}</span> : null}
            </summary>
            <div className="border border-t-0 border-line p-4">{panel}</div>
          </details>
          <Form action={localizedPath("cards", locale)} role="search" className="flex min-w-0 flex-1">
            {filters.color ? <input type="hidden" name="color" value={filters.color} /> : null}
            {filters.type ? <input type="hidden" name="type" value={filters.type} /> : null}
            {filters.cost !== undefined ? <input type="hidden" name="cost" value={filters.cost} /> : null}
            <input
              name="q"
              type="search"
              defaultValue={filters.q ?? ""}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.search}
              enterKeyHint="search"
              className="h-10 min-w-0 flex-1 border border-line bg-panel px-3 text-sm outline-none focus:border-cyan"
            />
            <button type="submit" className="h-10 shrink-0 border border-l-0 border-line bg-panel px-4 text-sm text-cyan hover:bg-cyan/10">
              {copy.search}
            </button>
          </Form>
        </div>
        <p className="mb-3 text-sm text-muted" aria-live="polite">
          {copy.results(cards.length)}
        </p>
        {cards.length ? (
          <ul className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4 2xl:grid-cols-5">
            {cards.map((card, index) => (
              <CardTile key={card.slug} card={card} locale={locale} eager={index < 6} />
            ))}
          </ul>
        ) : (
          <p className="border border-line px-4 py-10 text-center text-sm text-muted">{copy.empty}</p>
        )}
      </div>
    </div>
  );
}

/** Toutes les fiches, prérendues au build (régénérées ensuite toutes les heures). */
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
                <CardTile key={other.slug} card={other} locale={locale} compact />
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </div>
  );
}
