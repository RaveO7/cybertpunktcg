// Géocodage côté serveur, sans clé d'API :
// - France : Géoplateforme IGN (ex-API Adresse), qui autorise l'autocomplétion ;
// - autres pays : Nominatim (OpenStreetMap), UN appel par demande explicite (« Localiser »),
//   jamais en autocomplétion (interdit par sa politique d'usage), 1 requête/s au total.
// Les réponses sont gardées 30 jours en base pour ménager ces services gratuits.

import type { Place } from "./location";

export const IGN_SEARCH_URL = "https://data.geopf.fr/geocodage/search";
export const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";
export const GEOCODE_CACHE_TTL_MS = 30 * 24 * 60 * 60_000;
const TIMEOUT_MS = 6_000;

/** Service indisponible, saturé ou réponse illisible : l'utilisateur doit réessayer. */
export class GeocodeUnavailableError extends Error {
  constructor(readonly key: "geo.unavailable" | "geo.busy" = "geo.unavailable") {
    super(key);
  }
}

export type AddressSuggestion = Place & { label: string };
export type CitySuggestion = { city: string; region: string | null; country: string; lat: number; lng: number };
export type AddressParts = { street: string; postalCode?: string | null; city: string };

export type GeocodeCacheStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
};

export type GeocoderDeps = {
  fetch: typeof fetch;
  cache: GeocodeCacheStore;
  /** Limite globale vers Nominatim (une requête par seconde) : false = refuser. */
  acquireNominatimSlot: () => Promise<boolean>;
  userAgent: string;
};

const clean = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

function queryKey(value: string) {
  return value.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

async function fetchJson(deps: GeocoderDeps, url: URL, headers: Record<string, string> = {}): Promise<unknown> {
  let response: Response;
  try {
    response = await deps.fetch(url, { headers: { accept: "application/json", ...headers }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new GeocodeUnavailableError();
  }
  if (!response.ok) throw new GeocodeUnavailableError();
  try {
    return await response.json();
  } catch {
    throw new GeocodeUnavailableError();
  }
}

async function cached<T>(deps: GeocoderDeps, key: string, load: () => Promise<T>): Promise<T> {
  const hit = await deps.cache.get(key).catch(() => null);
  if (hit !== null) {
    try {
      return JSON.parse(hit) as T;
    } catch {
      // Entrée illisible : on recharge.
    }
  }
  const value = await load();
  await deps.cache.set(key, JSON.stringify(value)).catch(() => undefined);
  return value;
}

// --- IGN (France) ----------------------------------------------------------------------------

type IgnFeature = {
  geometry?: { coordinates?: unknown };
  properties?: Record<string, unknown>;
};

/** « 69, Rhône, Auvergne-Rhône-Alpes » → « Auvergne-Rhône-Alpes ». */
function ignRegion(context: unknown) {
  const text = clean(context);
  if (!text) return null;
  const parts = text.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : null;
}

function ignFeatures(json: unknown): IgnFeature[] {
  const features = (json as { features?: unknown })?.features;
  return Array.isArray(features) ? (features as IgnFeature[]) : [];
}

function ignPoint(feature: IgnFeature) {
  const coordinates = feature.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const [lng, lat] = coordinates;
  return typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;
}

export function parseIgnAddresses(json: unknown): AddressSuggestion[] {
  const out: AddressSuggestion[] = [];
  for (const feature of ignFeatures(json)) {
    const props = feature.properties ?? {};
    const point = ignPoint(feature);
    const city = clean(props.city);
    const label = clean(props.label);
    if (!point || !city || !label) continue;
    const type = clean(props.type);
    // Une commune seule n'est pas une adresse : son nom tient lieu de rue.
    const address = type === "municipality" ? city : (clean(props.name) ?? label);
    out.push({
      label,
      venueName: null,
      address,
      postalCode: clean(props.postcode),
      city,
      region: ignRegion(props.context),
      country: "FR",
      lat: point.lat,
      lng: point.lng,
    });
  }
  return out;
}

export function parseIgnCities(json: unknown): CitySuggestion[] {
  const out: CitySuggestion[] = [];
  for (const feature of ignFeatures(json)) {
    const props = feature.properties ?? {};
    const point = ignPoint(feature);
    const city = clean(props.city) ?? clean(props.name);
    if (!point || !city) continue;
    out.push({ city, region: ignRegion(props.context), country: "FR", lat: point.lat, lng: point.lng });
  }
  return out;
}

// --- Nominatim (reste du monde) --------------------------------------------------------------

type NominatimResult = {
  lat?: unknown;
  lon?: unknown;
  display_name?: unknown;
  address?: Record<string, unknown>;
};

export function parseNominatim(json: unknown, country: string, parts: AddressParts): AddressSuggestion | null {
  if (!Array.isArray(json) || json.length === 0) return null;
  const first = json[0] as NominatimResult;
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const address = first.address ?? {};
  const resultCountry = clean(address.country_code)?.toUpperCase() ?? country;
  if (resultCountry !== country) return null;
  const city =
    clean(address.city) ?? clean(address.town) ?? clean(address.village) ?? clean(address.municipality) ?? parts.city.trim();
  const road = clean(address.road);
  const street = road ? [clean(address.house_number), road].filter(Boolean).join(" ") : parts.street.trim();
  return {
    label: clean(first.display_name) ?? `${street}, ${city}`,
    venueName: null,
    address: street,
    postalCode: clean(address.postcode) ?? clean(parts.postalCode),
    city,
    region: clean(address.state) ?? clean(address.region) ?? clean(address.county),
    country,
    lat,
    lng,
  };
}

// --- API -------------------------------------------------------------------------------------

export function createGeocoder(deps: GeocoderDeps) {
  return {
    /** Suggestions d'adresses pendant la saisie : France uniquement. */
    async suggestAddresses(query: string, country: string): Promise<AddressSuggestion[]> {
      const q = query.trim();
      if (country !== "FR" || q.length < 3) return [];
      return cached(deps, `ign:address:${queryKey(q)}`, async () => {
        const url = new URL(IGN_SEARCH_URL);
        url.searchParams.set("q", q.slice(0, 200));
        url.searchParams.set("index", "address");
        url.searchParams.set("autocomplete", "1");
        url.searchParams.set("limit", "6");
        return parseIgnAddresses(await fetchJson(deps, url));
      });
    },

    /** Résolution d'une adresse saisie en entier (bouton « Localiser »), tous pays. */
    async resolveAddress(parts: AddressParts, country: string): Promise<AddressSuggestion | null> {
      const street = parts.street.trim();
      const city = parts.city.trim();
      const postalCode = parts.postalCode?.trim() ?? "";
      if (!street || !city) return null;
      const key = `${country}:${queryKey(`${street}|${postalCode}|${city}`)}`;
      if (country === "FR") {
        return cached(deps, `ign:resolve:${key}`, async () => {
          const url = new URL(IGN_SEARCH_URL);
          url.searchParams.set("q", `${street} ${postalCode} ${city}`.replace(/\s+/g, " ").slice(0, 200));
          url.searchParams.set("index", "address");
          url.searchParams.set("limit", "1");
          return parseIgnAddresses(await fetchJson(deps, url))[0] ?? null;
        });
      }
      return cached(deps, `nominatim:resolve:${key}`, async () => {
        if (!(await deps.acquireNominatimSlot())) {
          throw new GeocodeUnavailableError("geo.busy");
        }
        const url = new URL(NOMINATIM_SEARCH_URL);
        url.searchParams.set("format", "jsonv2");
        url.searchParams.set("addressdetails", "1");
        url.searchParams.set("limit", "1");
        url.searchParams.set("countrycodes", country.toLowerCase());
        url.searchParams.set("street", street.slice(0, 200));
        url.searchParams.set("city", city.slice(0, 100));
        if (postalCode) url.searchParams.set("postalcode", postalCode.slice(0, 20));
        const json = await fetchJson(deps, url, { "user-agent": deps.userAgent, "accept-language": "fr,en" });
        return parseNominatim(json, country, parts);
      });
    },

    /** Communes françaises pour la recherche « autour de… » de l'annuaire. */
    async suggestFrenchCities(query: string): Promise<CitySuggestion[]> {
      const q = query.trim();
      if (q.length < 2) return [];
      return cached(deps, `ign:city:${queryKey(q)}`, async () => {
        const url = new URL(IGN_SEARCH_URL);
        url.searchParams.set("q", q.slice(0, 100));
        url.searchParams.set("index", "address");
        url.searchParams.set("type", "municipality");
        url.searchParams.set("autocomplete", "1");
        url.searchParams.set("limit", "6");
        return parseIgnCities(await fetchJson(deps, url));
      });
    },
  };
}

export type Geocoder = ReturnType<typeof createGeocoder>;
