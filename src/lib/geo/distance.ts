// Distances à vol d'oiseau et boîte englobante d'un rayon, pour filtrer en SQL sans extension
// géographique (SQLite en local, Postgres en production).

const EARTH_RADIUS_KM = 6371;
const KM_PER_DEGREE_LAT = 111.32;

export type Point = { lat: number; lng: number };

const toRad = (degrees: number) => (degrees * Math.PI) / 180;

/** Distance orthodromique (formule de haversine), en kilomètres. */
export function haversineKm(a: Point, b: Point) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type BoundingBox = { minLat: number; maxLat: number; minLng: number; maxLng: number };

/**
 * Boîte contenant le disque de rayon `radiusKm` : premier filtre (indexable) avant le calcul
 * exact. Près des pôles, ou si la boîte déborde l'antiméridien, la longitude n'est pas bornée.
 */
export function boundingBox(center: Point, radiusKm: number): BoundingBox {
  const dLat = radiusKm / KM_PER_DEGREE_LAT;
  const minLat = Math.max(-90, center.lat - dLat);
  const maxLat = Math.min(90, center.lat + dLat);
  const cos = Math.cos(toRad(center.lat));
  const dLng = cos > 1e-6 ? radiusKm / (KM_PER_DEGREE_LAT * cos) : 180;
  if (dLng >= 180 || center.lng - dLng < -180 || center.lng + dLng > 180) {
    return { minLat, maxLat, minLng: -180, maxLng: 180 };
  }
  return { minLat, maxLat, minLng: center.lng - dLng, maxLng: center.lng + dLng };
}

/** Arrondi d'affichage : au dixième sous 10 km, au kilomètre au-delà. */
export function roundDistanceKm(km: number) {
  return km < 10 ? Math.round(km * 10) / 10 : Math.round(km);
}
