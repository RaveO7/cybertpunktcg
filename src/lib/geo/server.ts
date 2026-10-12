// Géocodeur de l'app (cache et limite globale en base) et villes déjà connues de l'annuaire.

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { createGeocoder, GEOCODE_CACHE_TTL_MS, type CitySuggestion } from "./geocode";
import { cityKey } from "./location";

export const geocoder = createGeocoder({
  fetch: (...args) => fetch(...args),
  cache: {
    async get(key) {
      const row = await prisma.geocodeCache.findUnique({ where: { key } });
      if (!row || row.createdAt.getTime() < Date.now() - GEOCODE_CACHE_TTL_MS) return null;
      return row.resultJson;
    },
    async set(key, value) {
      await prisma.geocodeCache.upsert({
        where: { key },
        create: { key, resultJson: value },
        update: { resultJson: value, createdAt: new Date() },
      });
    },
  },
  acquireNominatimSlot: async () => (await rateLimit("geocode:nominatim", 1, 1_000)).ok,
  userAgent: `CyberpunkTCG/1.0 (${process.env.APP_URL?.trim() || "https://cybertpunktcg.vercel.app"})`,
});

/** Purge des réponses de géocodage expirées (cron quotidien). */
export async function purgeGeocodeCache(now = new Date()) {
  const { count } = await prisma.geocodeCache.deleteMany({
    where: { createdAt: { lt: new Date(now.getTime() - GEOCODE_CACHE_TTL_MS) } },
  });
  return count;
}

/**
 * Villes ayant des tournois publics à venir ou des boutiques non refusées dont le nom commence
 * par `query` (sans casse ni accents), avec un point moyen pour la recherche par rayon.
 */
export async function knownCities(query: string, now = new Date(), limit = 8): Promise<CitySuggestion[]> {
  const prefix = cityKey(query);
  if (prefix.length < 2) return [];
  const since = new Date(now.getTime() - 12 * 60 * 60_000);
  const [tournaments, shops] = await Promise.all([
    prisma.tournament.findMany({
      where: {
        visibility: "public",
        status: { notIn: ["termine", "annule"] },
        startsAt: { gte: since },
        cityKey: { startsWith: prefix },
      },
      select: { city: true, cityKey: true, region: true, country: true, lat: true, lng: true },
      take: 200,
    }),
    prisma.shop.findMany({
      where: { status: { not: "rejected" }, cityKey: { startsWith: prefix } },
      select: { city: true, cityKey: true, region: true, country: true, lat: true, lng: true },
      take: 200,
    }),
  ]);
  const groups = new Map<string, { city: string; region: string | null; country: string; lat: number; lng: number; n: number }>();
  for (const row of [...tournaments, ...shops]) {
    if (!row.city || !row.cityKey || !row.country || row.lat === null || row.lng === null) continue;
    const key = `${row.country}:${row.cityKey}`;
    const group = groups.get(key);
    if (group) {
      group.lat += row.lat;
      group.lng += row.lng;
      group.n += 1;
    } else {
      groups.set(key, { city: row.city, region: row.region, country: row.country, lat: row.lat, lng: row.lng, n: 1 });
    }
  }
  return [...groups.values()]
    .sort((a, b) => b.n - a.n || a.city.localeCompare(b.city))
    .slice(0, limit)
    .map(({ n, ...group }) => ({ ...group, lat: group.lat / n, lng: group.lng / n }));
}
