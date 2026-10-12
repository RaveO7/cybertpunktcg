// Annuaire des tournois publics (cf. specs/tournaments/discovery). Filtres simples en SQL
// (lieu, boîte englobante du rayon, dates, format, prix), puis en mémoire ce qui dépend des
// inscrits (places restantes, inscriptions ouvertes) et la distance exacte.

import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import type { directoryQuerySchema } from "@/lib/api-schemas";
import { boundingBox, haversineKm, roundDistanceKm, type Point } from "@/lib/geo/distance";
import { cityKey } from "@/lib/geo/location";
import { prisma } from "@/lib/prisma";
import { buildPublicSummary, buildPublicView, type PublicTournamentSummary } from "./public-view";
import { loadTournament } from "./repository";

/** Un tournoi commencé reste listé 12 h (journée en cours), puis disparaît. */
export const LISTED_AFTER_START_MS = 12 * 60 * 60_000;
export const DIRECTORY_PAGE_SIZE = 50;
export const DIRECTORY_MAP_LIMIT = 500;
/** Plafond de lignes lues en base avant les filtres en mémoire. */
const SCAN_LIMIT = 2000;

export type DirectoryQuery = {
  country?: string;
  region?: string;
  city?: string;
  near?: Point & { radiusKm: number };
  from?: Date;
  to?: Date;
  format?: "boutique" | "competitif";
  matchType?: "bo1" | "bo3";
  price?: "free" | "paid";
  seatsOnly?: boolean;
  openOnly?: boolean;
  shop?: string;
  sort?: "date" | "distance";
  page?: number;
  /** Vue carte : jusqu'à 500 tournois, sans pagination. */
  map?: boolean;
};

export type DirectoryResult = {
  total: number;
  page: number;
  pageSize: number;
  tournaments: PublicTournamentSummary[];
};

const summarySelect = {
  id: true,
  name: true,
  status: true,
  startsAt: true,
  timeZone: true,
  venueName: true,
  city: true,
  region: true,
  country: true,
  lat: true,
  lng: true,
  format: true,
  matchType: true,
  entryFeeCents: true,
  currency: true,
  maxPlayers: true,
  registrationOpen: true,
  players: { select: { id: true, status: true, createdAt: true } },
  shop: { select: { slug: true, name: true, status: true, logoUpdatedAt: true } },
} satisfies Prisma.TournamentSelect;

type SummaryRow = Prisma.TournamentGetPayload<{ select: typeof summarySelect }>;

/** Conditions communes : public, à venir ou en cours depuis moins de 12 h. */
export function listedWhere(now: Date): Prisma.TournamentWhereInput {
  return {
    visibility: "public",
    status: { notIn: ["termine", "annule"] },
    startsAt: { gte: new Date(now.getTime() - LISTED_AFTER_START_MS) },
    lat: { not: null },
    lng: { not: null },
  };
}

/** Filtres validés (directoryQuerySchema) → requête d'annuaire. */
export function directoryQueryFromParams(params: z.output<typeof directoryQuerySchema>): DirectoryQuery {
  return {
    country: params.country,
    region: params.region,
    city: params.city,
    near: params.near,
    from: params.from ? new Date(params.from) : undefined,
    to: params.to ? new Date(params.to) : undefined,
    format: params.format,
    matchType: params.match,
    price: params.price,
    seatsOnly: params.seats,
    openOnly: params.open,
    shop: params.shop,
    sort: params.sort,
    page: params.page,
    map: params.view === "map",
  };
}

function buildWhere(query: DirectoryQuery, now: Date): Prisma.TournamentWhereInput {
  const and: Prisma.TournamentWhereInput[] = [listedWhere(now)];
  if (query.country) and.push({ country: query.country });
  if (query.region) and.push({ region: query.region });
  if (query.city) and.push({ cityKey: cityKey(query.city) });
  if (query.near) {
    const box = boundingBox(query.near, query.near.radiusKm);
    and.push({ lat: { gte: box.minLat, lte: box.maxLat }, lng: { gte: box.minLng, lte: box.maxLng } });
  }
  if (query.from) and.push({ startsAt: { gte: query.from } });
  if (query.to) and.push({ startsAt: { lt: query.to } });
  if (query.format) and.push({ format: query.format });
  if (query.matchType) and.push({ matchType: query.matchType });
  if (query.price === "free") and.push({ entryFeeCents: null });
  if (query.price === "paid") and.push({ entryFeeCents: { not: null } });
  if (query.shop) and.push({ shop: { slug: query.shop, status: { not: "rejected" } } });
  return { AND: and };
}

function verifiedFirst(a: PublicTournamentSummary, b: PublicTournamentSummary) {
  return Number(b.shop?.verified ?? false) - Number(a.shop?.verified ?? false);
}

function byDate(a: PublicTournamentSummary, b: PublicTournamentSummary) {
  return (a.startsAt ?? "").localeCompare(b.startsAt ?? "");
}

export function sortSummaries(rows: PublicTournamentSummary[], sort: "date" | "distance") {
  return rows.sort((a, b) => {
    if (sort === "distance" && a.distanceKm !== null && b.distanceKm !== null) {
      const diff = a.distanceKm - b.distanceKm;
      if (diff) return diff;
    } else {
      const diff = byDate(a, b);
      if (diff) return diff;
    }
    return verifiedFirst(a, b) || byDate(a, b) || a.id.localeCompare(b.id);
  });
}

export async function searchPublicTournaments(query: DirectoryQuery, now = new Date()): Promise<DirectoryResult> {
  const rows: SummaryRow[] = await prisma.tournament.findMany({
    where: buildWhere(query, now),
    select: summarySelect,
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: SCAN_LIMIT,
  });
  const near = query.near;
  let summaries = rows.flatMap((row) => {
    let distance: number | null = null;
    if (near) {
      distance = haversineKm(near, { lat: row.lat!, lng: row.lng! });
      if (distance > near.radiusKm) return [];
    }
    return [buildPublicSummary(row, distance === null ? null : roundDistanceKm(distance))];
  });
  if (query.seatsOnly) summaries = summaries.filter((row) => row.seatsLeft === null || row.seatsLeft > 0);
  if (query.openOnly) summaries = summaries.filter((row) => row.registrationOpen);
  sortSummaries(summaries, query.sort === "distance" && near ? "distance" : "date");

  if (query.map) {
    return { total: summaries.length, page: 1, pageSize: DIRECTORY_MAP_LIMIT, tournaments: summaries.slice(0, DIRECTORY_MAP_LIMIT) };
  }
  const page = Math.max(1, query.page ?? 1);
  return {
    total: summaries.length,
    page,
    pageSize: DIRECTORY_PAGE_SIZE,
    tournaments: summaries.slice((page - 1) * DIRECTORY_PAGE_SIZE, page * DIRECTORY_PAGE_SIZE),
  };
}

export type DirectoryFacets = { countries: string[]; regions: string[]; cities: { key: string; name: string }[] };

/** Choix des filtres de lieu, limités aux tournois listés et au niveau supérieur choisi. */
export async function directoryFacets(country: string | undefined, region: string | undefined, now = new Date()): Promise<DirectoryFacets> {
  const base = listedWhere(now);
  const countries = await prisma.tournament.findMany({
    where: base,
    distinct: ["country"],
    select: { country: true },
    orderBy: { country: "asc" },
  });
  const regions = country
    ? await prisma.tournament.findMany({
        where: { AND: [base, { country, region: { not: null } }] },
        distinct: ["region"],
        select: { region: true },
        orderBy: { region: "asc" },
      })
    : [];
  const cities = country
    ? await prisma.tournament.findMany({
        where: { AND: [base, { country }, region ? { region } : {}] },
        distinct: ["cityKey"],
        select: { cityKey: true, city: true },
        orderBy: { cityKey: "asc" },
      })
    : [];
  return {
    countries: countries.flatMap((row) => (row.country ? [row.country] : [])),
    regions: regions.flatMap((row) => (row.region ? [row.region] : [])),
    cities: cities.flatMap((row) => (row.cityKey && row.city ? [{ key: row.cityKey, name: row.city }] : [])),
  };
}

/** Tournoi public complet, ou null (inexistant ou privé : même réponse « introuvable »). */
export async function findPublicTournament(id: string) {
  const t = await loadTournament(prisma, id);
  return t && t.visibility === "public" ? t : null;
}

/** Tournois publics d'une boutique : à venir, et les 10 derniers terminés. */
export async function shopTournaments(shopId: string, now = new Date()) {
  const [upcoming, past] = await Promise.all([
    prisma.tournament.findMany({
      where: { AND: [listedWhere(now), { shopId }] },
      select: summarySelect,
      orderBy: [{ startsAt: "asc" }, { id: "asc" }],
      take: 50,
    }),
    prisma.tournament.findMany({
      where: { visibility: "public", shopId, status: "termine" },
      select: { id: true },
      orderBy: [{ startsAt: "desc" }, { updatedAt: "desc" }],
      take: 10,
    }),
  ]);
  // Le champion dépend du classement complet (sans top cut, c'est le premier du suisse).
  const results = await Promise.all(past.map((row) => loadTournament(prisma, row.id)));
  return {
    upcoming: upcoming.map((row) => buildPublicSummary(row)),
    past: results.flatMap((t) => {
      if (!t) return [];
      const view = buildPublicView(t);
      return [{ ...buildPublicSummary(t), championName: view.championName, playerCount: view.standings?.length ?? 0 }];
    }),
  };
}
