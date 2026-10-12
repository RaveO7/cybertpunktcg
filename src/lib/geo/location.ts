// Lieu normalisé d'un tournoi ou d'une boutique, stocké à plat dans les deux tables
// (venueName, address, postalCode, city, cityKey, region, country, lat, lng).

export type Place = {
  venueName: string | null;
  address: string;
  postalCode: string | null;
  city: string;
  region: string | null;
  /** Code ISO 3166-1 alpha-2, en majuscules. */
  country: string;
  lat: number;
  lng: number;
};

export type PlaceColumns = Place & { cityKey: string };

/** Clé de ville : sans casse, accents, tirets ni espaces superflus (« Saint-Étienne » = « saint etienne »). */
export function cityKey(city: string) {
  return city
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[-'’]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function isCountryCode(value: unknown): value is string {
  return typeof value === "string" && /^[A-Z]{2}$/.test(value);
}

/** Lieu complet (pays, ville, coordonnées valides), ou null. */
export function normalizePlace(input: Partial<Place> | null | undefined): Place | null {
  if (!input) return null;
  const text = (value: unknown, max: number) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim().replace(/\s+/g, " ");
    return trimmed ? trimmed.slice(0, max) : null;
  };
  const country = typeof input.country === "string" ? input.country.trim().toUpperCase() : null;
  const city = text(input.city, 100);
  const address = text(input.address, 200);
  const { lat, lng } = input;
  if (!isCountryCode(country) || !city || !address) return null;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    venueName: text(input.venueName, 100),
    address,
    postalCode: text(input.postalCode, 20),
    city,
    region: text(input.region, 100),
    country,
    lat,
    lng,
  };
}

export function toPlaceColumns(place: Place): PlaceColumns {
  return { ...place, cityKey: cityKey(place.city) };
}

/** Colonnes de lieu d'une ligne (tournoi ou boutique) → lieu, ou null s'il est incomplet. */
export function placeFromRow(row: {
  venueName: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
}): Place | null {
  if (!row.address || !row.city || !row.country || row.lat === null || row.lng === null) return null;
  return {
    venueName: row.venueName,
    address: row.address,
    postalCode: row.postalCode,
    city: row.city,
    region: row.region,
    country: row.country,
    lat: row.lat,
    lng: row.lng,
  };
}

/** Colonnes à écrire pour effacer un lieu (tournoi seulement : une boutique en a toujours un). */
export const EMPTY_PLACE_COLUMNS = {
  venueName: null,
  address: null,
  postalCode: null,
  city: null,
  cityKey: null,
  region: null,
  country: null,
  lat: null,
  lng: null,
} as const;
