"use client";

// Saisie d'un lieu (cf. specs/locations/geocoding) : en France, suggestions pendant la frappe ;
// ailleurs, rue + code postal + ville puis « Localiser » (un seul appel). Le lieu résolu est
// montré sur une carte avant l'enregistrement.

import { useEffect, useId, useMemo, useState } from "react";
import { useI18n } from "@/components/LocaleProvider";
import { buttonClass, inputClass } from "@/components/tournament/ui";
import type { AddressSuggestion } from "@/lib/geo/geocode";
import type { Place } from "@/lib/geo/location";
import { countryOptions } from "./countries";
import { LazyMap, type MapMarker } from "./LazyMap";

export function placeLabel(place: Place) {
  return [place.venueName, place.address, [place.postalCode, place.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

export function AddressField({
  value,
  onChange,
  disabled = false,
  allowClear = false,
}: {
  value: Place | null;
  onChange: (place: Place | null) => void;
  disabled?: boolean;
  allowClear?: boolean;
}) {
  const { t, locale } = useI18n();
  const listId = useId();
  const [editing, setEditing] = useState(value === null);
  const [country, setCountry] = useState(value?.country ?? "FR");
  const [query, setQuery] = useState("");
  const [street, setStreet] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [venueName, setVenueName] = useState(value?.venueName ?? "");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Suggestions IGN (France) : 300 ms après la dernière frappe.
  useEffect(() => {
    if (!editing || country !== "FR" || query.trim().length < 3) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/geocode/suggest?country=FR&q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const body = (await response.json().catch(() => ({}))) as { suggestions?: AddressSuggestion[]; error?: string };
        if (!response.ok) {
          setMessage(body.error ?? t.geo.retry);
          return;
        }
        setMessage(body.suggestions?.length ? null : t.geo.noSuggestion);
        setSuggestions(body.suggestions ?? []);
      } catch {
        // Requête annulée par une frappe plus récente.
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, country, editing, t]);

  function choose(place: Place) {
    onChange({ ...place, venueName: venueName.trim() || null });
    setEditing(false);
    setSuggestions([]);
    setQuery("");
    setMessage(null);
  }

  async function locate() {
    if (!street.trim() || !city.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/geocode/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ country, street: street.trim(), postalCode: postalCode.trim() || undefined, city: city.trim() }),
      });
      const body = (await response.json().catch(() => ({}))) as { place?: AddressSuggestion; error?: string };
      if (!response.ok || !body.place) {
        setMessage(body.error ?? (response.status === 404 ? t.geo.notFound : t.geo.retry));
        return;
      }
      choose(body.place);
    } catch {
      setMessage(t.geo.retry);
    } finally {
      setBusy(false);
    }
  }

  const countries = countryOptions(locale, value ? [value.country] : []);
  // Repère stable : la carte ne se recentre pas à chaque frappe dans le nom du lieu.
  const markers = useMemo<MapMarker[]>(
    () => (value ? [{ lat: value.lat, lng: value.lng, items: [{ label: placeLabel(value), href: "#" }], highlight: true }] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seul l'emplacement compte
    [value?.lat, value?.lng],
  );

  if (value && !editing) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm">
          <span className="text-foreground">{placeLabel(value)}</span>
          <span className="text-muted"> · {countries.find((entry) => entry.code === value.country)?.name ?? value.country}</span>
        </p>
        <LazyMap markers={markers} zoom={16} label={t.geo.mapLabel} className="h-48" />
        <label className="flex flex-col gap-1">
          <span className="hud-label">{t.geo.venueName}</span>
          <input
            className={inputClass}
            value={venueName}
            maxLength={100}
            disabled={disabled}
            onChange={(event) => setVenueName(event.target.value)}
            onBlur={() => onChange({ ...value, venueName: venueName.trim() || null })}
          />
        </label>
        {!disabled ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={() => setEditing(true)}>
              {t.geo.change}
            </button>
            {allowClear ? (
              <button type="button" className={buttonClass} onClick={() => onChange(null)}>
                {t.geo.clear}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1">
        <span className="hud-label">{t.geo.country}</span>
        <select
          className={inputClass}
          value={country}
          disabled={disabled}
          onChange={(event) => {
            setCountry(event.target.value);
            setSuggestions([]);
            setMessage(null);
          }}
        >
          {countries.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>

      {country === "FR" ? (
        <div className="flex flex-col gap-1">
          <label className="flex flex-col gap-1">
            <span className="hud-label">{t.geo.address}</span>
            <input
              className={inputClass}
              value={query}
              placeholder={t.geo.addressPlaceholder}
              autoComplete="off"
              disabled={disabled}
              role="combobox"
              aria-expanded={suggestions.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              onChange={(event) => {
                setQuery(event.target.value);
                if (event.target.value.trim().length < 3) setSuggestions([]);
              }}
            />
          </label>
          {suggestions.length ? (
            <ul id={listId} role="listbox" className="flex flex-col border border-line bg-panel">
              {suggestions.map((suggestion) => (
                <li key={`${suggestion.label}-${suggestion.lat}`} role="option" aria-selected={false}>
                  <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-panel-2" onClick={() => choose(suggestion)}>
                    {suggestion.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr_2fr]">
          <label className="flex flex-col gap-1">
            <span className="hud-label">{t.geo.street}</span>
            <input className={inputClass} value={street} maxLength={200} disabled={disabled} onChange={(event) => setStreet(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="hud-label">{t.geo.postalCode}</span>
            <input className={inputClass} value={postalCode} maxLength={20} disabled={disabled} onChange={(event) => setPostalCode(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="hud-label">{t.geo.city}</span>
            <input className={inputClass} value={city} maxLength={100} disabled={disabled} onChange={(event) => setCity(event.target.value)} />
          </label>
          <div className="sm:col-span-3">
            <button type="button" className={buttonClass} disabled={disabled || busy || !street.trim() || !city.trim()} onClick={() => void locate()}>
              {busy ? t.geo.locating : t.geo.locate}
            </button>
          </div>
        </div>
      )}

      {message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}
      {value ? (
        <button type="button" className={`${buttonClass} self-start`} onClick={() => setEditing(false)}>
          {t.geo.keep}
        </button>
      ) : null}
    </div>
  );
}
