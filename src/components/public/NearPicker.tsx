"use client";

// Point de recherche « autour de… » : géolocalisation du navigateur (avec accord) ou ville
// choisie dans les suggestions. La position n'est jamais envoyée au serveur pour être gardée :
// elle ne sert que de paramètre de recherche, arrondie à ~1 km.

import { useEffect, useState } from "react";
import { useI18n } from "@/components/LocaleProvider";
import { buttonClass, inputClass } from "@/components/tournament/ui";
import type { CitySuggestion } from "@/lib/geo/geocode";
import { SEARCH_RADII_KM } from "@/lib/tournament/listing";
import { countryName } from "@/components/geo/countries";

export type NearPoint = { lat: number; lng: number; radius: number; label: string };

const round2 = (value: number) => Math.round(value * 100) / 100;

export function NearPicker({ value, onChange }: { value: NearPoint | null; onChange: (point: NearPoint | null) => void }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState<CitySuggestion[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const radius = value?.radius ?? 25;

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode/cities?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const body = (await response.json().catch(() => ({}))) as { cities?: CitySuggestion[] };
        setCities(body.cities ?? []);
      } catch {
        // Annulée par une frappe plus récente.
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  function aroundMe() {
    if (!("geolocation" in navigator)) {
      setMessage(t.geo.geolocUnavailable);
      return;
    }
    setLocating(true);
    setMessage(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        // Libellé vide = « autour de moi », traduit à l'affichage (le lien peut être partagé).
        onChange({ lat: round2(position.coords.latitude), lng: round2(position.coords.longitude), radius, label: "" });
      },
      (error) => {
        setLocating(false);
        setMessage(error.code === error.PERMISSION_DENIED ? t.geo.geolocDenied : t.geo.geolocUnavailable);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <button type="button" className={buttonClass} disabled={locating} onClick={aroundMe}>
          {locating ? t.geo.locating : t.geo.aroundMe}
        </button>
        <label className="relative flex min-w-48 flex-1 flex-col gap-1">
          <span className="hud-label">{t.geo.aroundCity}</span>
          <input
            className={inputClass}
            value={query}
            placeholder={value?.label || t.geo.cityPlaceholder}
            autoComplete="off"
            onChange={(event) => {
              setQuery(event.target.value);
              if (event.target.value.trim().length < 2) setCities([]);
            }}
          />
          {cities.length && query.trim().length >= 2 ? (
            <ul className="absolute top-full right-0 left-0 z-20 flex flex-col border border-line bg-panel shadow-lg">
              {cities.map((city) => (
                <li key={`${city.country}-${city.city}-${city.lat}`}>
                  <button
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm hover:bg-panel-2"
                    onClick={() => {
                      onChange({ lat: round2(city.lat), lng: round2(city.lng), radius, label: city.city });
                      setQuery("");
                      setCities([]);
                      setMessage(null);
                    }}
                  >
                    {city.city}
                    <span className="text-muted"> · {[city.region, countryName(city.country, locale)].filter(Boolean).join(", ")}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </label>
        <label className="flex flex-col gap-1">
          <span className="hud-label">{t.geo.radius}</span>
          <select
            className={inputClass}
            value={radius}
            onChange={(event) => {
              if (value) onChange({ ...value, radius: Number(event.target.value) });
              else setMessage(t.geo.pickPointFirst);
            }}
          >
            {SEARCH_RADII_KM.map((km) => (
              <option key={km} value={km}>
                {t.geo.km(km)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {value ? (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-cyan">{t.geo.around(value.label || t.geo.aroundMe, value.radius)}</span>
          <button type="button" className="text-xs text-muted underline" onClick={() => onChange(null)}>
            {t.geo.clearPoint}
          </button>
        </p>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-yellow">
          {message}
        </p>
      ) : null}
    </div>
  );
}
