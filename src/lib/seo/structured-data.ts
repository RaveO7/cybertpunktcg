/** Données structurées schema.org (JSON-LD) des pages publiques. Fonctions pures, URL absolues. */

import type { Place } from "@/lib/geo/location";
import type { ShopDetail } from "@/lib/shops/shops";
import type { PublicTournamentDetail, PublicTournamentSummary } from "@/lib/tournament/public-view";
import { SOCIAL_LINKS, SITE } from "@/lib/site";
import { localizedPath, type SiteLocale } from "@/lib/seo/routes";
import { absoluteUrl } from "@/lib/seo/site";

export type JsonLdObject = { [key: string]: unknown };

const CONTEXT = "https://schema.org";
export const GAME_NAME = "Cyberpunk TCG";

/** Sérialisation sûre dans <script> : aucun « < » ne peut fermer la balise. */
export function serializeJsonLd(data: JsonLdObject | JsonLdObject[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Supprime les propriétés vides (null, undefined, "", tableaux vides). */
function compact<T extends JsonLdObject>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(
      ([, value]) => value !== null && value !== undefined && value !== "" && !(Array.isArray(value) && value.length === 0),
    ),
  ) as T;
}

function toAbsolute(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//.test(url) ? url : absoluteUrl(url);
}

export function websiteLd(locale: SiteLocale): JsonLdObject {
  return {
    "@context": CONTEXT,
    "@type": "WebSite",
    name: SITE.name,
    url: absoluteUrl(localizedPath("home", locale)),
    inLanguage: locale,
  };
}

export function organizationLd(socials: { href: string }[] = SOCIAL_LINKS): JsonLdObject {
  return compact({
    "@context": CONTEXT,
    "@type": "Organization",
    name: SITE.name,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/icons/icon-512.png"),
    sameAs: socials.map((link) => link.href).filter(Boolean),
  });
}

export type Crumb = { name: string; path: string };

export function breadcrumbLd(crumbs: Crumb[]): JsonLdObject {
  return {
    "@context": CONTEXT,
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

export function itemListLd(items: { name: string; path: string }[]): JsonLdObject | null {
  if (items.length === 0) return null;
  return {
    "@context": CONTEXT,
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}

function postalAddress(place: Pick<Place, "address" | "postalCode" | "city" | "region" | "country">): JsonLdObject {
  return compact({
    "@type": "PostalAddress",
    streetAddress: place.address,
    postalCode: place.postalCode,
    addressLocality: place.city,
    addressRegion: place.region,
    addressCountry: place.country,
  });
}

function geo(lat: number | null, lng: number | null): JsonLdObject | null {
  return lat === null || lng === null ? null : { "@type": "GeoCoordinates", latitude: lat, longitude: lng };
}

function price(cents: number | null): string {
  return cents ? (cents / 100).toFixed(2) : "0";
}

/** Événement d'un tournoi public (statut, lieu, organisateur, offre d'inscription). */
export function eventLd(t: PublicTournamentDetail, locale: SiteLocale): JsonLdObject {
  const url = absoluteUrl(localizedPath("tournament", locale, { id: t.id }));
  const location = t.place
    ? compact({
        "@type": "Place",
        name: t.place.venueName ?? t.place.city,
        address: postalAddress(t.place),
        geo: geo(t.place.lat, t.place.lng),
      })
    : t.city
      ? compact({
          "@type": "Place",
          name: t.venueName ?? t.city,
          address: compact({ "@type": "PostalAddress", addressLocality: t.city, addressRegion: t.region, addressCountry: t.country }),
          geo: geo(t.lat, t.lng),
        })
      : null;
  const organizer = t.shop
    ? { "@type": "Organization", name: t.shop.name, url: absoluteUrl(localizedPath("shop", locale, { slug: t.shop.slug })) }
    : t.organizerName
      ? { "@type": "Person", name: t.organizerName }
      : null;
  return compact({
    "@context": CONTEXT,
    "@type": "Event",
    name: t.name,
    url,
    startDate: t.startsAt,
    eventStatus: `${CONTEXT}/${t.status === "annule" ? "EventCancelled" : "EventScheduled"}`,
    eventAttendanceMode: `${CONTEXT}/OfflineEventAttendanceMode`,
    location,
    organizer,
    description: t.description,
    inLanguage: locale,
    about: { "@type": "Game", name: GAME_NAME },
    offers: {
      "@type": "Offer",
      price: price(t.entryFeeCents),
      priceCurrency: t.currency,
      availability: `${CONTEXT}/${t.seatsLeft === 0 ? "SoldOut" : "InStock"}`,
      url,
    },
  });
}

/** Liste des tournois (annuaire, boutique) : chaque élément pointe vers sa fiche. */
export function tournamentListLd(
  tournaments: Pick<PublicTournamentSummary, "id" | "name">[],
  locale: SiteLocale,
): JsonLdObject | null {
  return itemListLd(tournaments.map((t) => ({ name: t.name, path: localizedPath("tournament", locale, { id: t.id }) })));
}

const DAYS: Record<string, string> = {
  lun: "Monday",
  mar: "Tuesday",
  mer: "Wednesday",
  jeu: "Thursday",
  ven: "Friday",
  sam: "Saturday",
  dim: "Sunday",
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};
const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function dayOf(token: string): string | null {
  const key = token
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .slice(0, 3);
  return DAYS[key] ?? null;
}

function timeOf(token: string): string | null {
  const match = /^(\d{1,2})(?:[h:.](\d{2})?)?\s*(am|pm)?$/i.exec(token.trim());
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  if (hours > 24 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

const HOURS_LINE = /^([A-Za-zÀ-ÿ]{3,9}\.?)(?:\s*[-–—]\s*([A-Za-zÀ-ÿ]{3,9}\.?))?\s*:?\s+(\S+?)\s*[-–—]\s*(\S+)$/;

/**
 * Horaires saisis librement (« Mar–Sam 10h–19h », « Tue-Sat 10am-7pm », une plage par ligne ou
 * séparées par « ; ») → OpeningHoursSpecification. Les lignes non reconnues sont ignorées.
 */
export function parseOpeningHours(text: string | null): JsonLdObject[] {
  if (!text) return [];
  const specs: JsonLdObject[] = [];
  for (const line of text.split(/[\n;]+/)) {
    const match = HOURS_LINE.exec(line.trim());
    if (!match) continue;
    const from = dayOf(match[1]);
    const to = match[2] ? dayOf(match[2]) : from;
    const opens = timeOf(match[3]);
    const closes = timeOf(match[4]);
    if (!from || !to || !opens || !closes) continue;
    const start = WEEK.indexOf(from);
    const end = WEEK.indexOf(to);
    const days = start <= end ? WEEK.slice(start, end + 1) : [...WEEK.slice(start), ...WEEK.slice(0, end + 1)];
    specs.push({ "@type": "OpeningHoursSpecification", dayOfWeek: days, opens, closes });
  }
  return specs;
}

/** Boutique locale : adresse, coordonnées, contact, horaires reconnus et réseaux. */
export function storeLd(shop: ShopDetail, locale: SiteLocale): JsonLdObject {
  return compact({
    "@context": CONTEXT,
    "@type": "Store",
    name: shop.name,
    url: absoluteUrl(localizedPath("shop", locale, { slug: shop.slug })),
    description: shop.description,
    address: postalAddress(shop.place),
    geo: geo(shop.lat, shop.lng),
    logo: toAbsolute(shop.logoUrl),
    image: toAbsolute(shop.logoUrl),
    telephone: shop.phone,
    openingHoursSpecification: parseOpeningHours(shop.hours),
    sameAs: [shop.website, ...shop.socials.map((social) => social.url)].filter((url): url is string => Boolean(url)),
  });
}

export type CardLdSource = {
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  artist: string | null;
};

/** Carte de jeu : œuvre appartenant au jeu Cyberpunk TCG. */
export function cardLd(card: CardLdSource, locale: SiteLocale): JsonLdObject {
  return compact({
    "@context": CONTEXT,
    "@type": "CreativeWork",
    name: card.name,
    url: absoluteUrl(localizedPath("card", locale, { slug: card.slug })),
    image: toAbsolute(card.image),
    description: card.description,
    inLanguage: locale,
    author: card.artist ? { "@type": "Person", name: card.artist } : null,
    isPartOf: { "@type": "Game", name: GAME_NAME },
  });
}
