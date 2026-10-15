"use client";

// Encadré « Publication » des réglages : visibilité, date, lieu, prix, places, présentation,
// lots et boutique organisatrice (cf. specs/tournaments/public-listing et capacity).

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AddressField } from "@/components/geo/AddressField";
import { browserTimeZone, fromLocalInput, toLocalInput } from "@/components/public/format";
import { TOURNAMENT_CURRENCIES } from "@/lib/tournament/listing";
import type { Place } from "@/lib/geo/location";
import type { TournamentView } from "@/lib/tournament/view";
import type { RunCommand } from "./TournamentConsole";
import { buttonClass, inputClass, panelClass, primaryClass, Tag } from "./ui";

type OwnedShop = { id: string; name: string; slug: string; status: string };

type Draft = {
  startsAt: string;
  place: Place | null;
  fee: string;
  currency: string;
  maxPlayers: string;
  description: string;
  prizes: string;
};

function draftOf(tournament: TournamentView["tournament"]): Draft {
  return {
    startsAt: toLocalInput(tournament.startsAt),
    place: tournament.place,
    fee: tournament.entryFeeCents === null ? "" : (tournament.entryFeeCents / 100).toFixed(2),
    currency: tournament.currency,
    maxPlayers: tournament.maxPlayers === null ? "" : String(tournament.maxPlayers),
    description: tournament.description ?? "",
    prizes: tournament.prizes ?? "",
  };
}

function samePlace(a: Place | null, b: Place | null) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function PublicationPanel({ view, run }: { view: TournamentView; run: RunCommand }) {
  const t = useTranslations();
  const tournament = view.tournament;
  const [draft, setDraft] = useState<Draft>(() => draftOf(tournament));
  const [shops, setShops] = useState<OwnedShop[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const readOnly = tournament.status === "termine" || tournament.status === "annule";
  const isPublic = tournament.visibility === "public";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/shops/mine", { cache: "no-store" })
      .then(async (response) => (response.ok ? ((await response.json()) as { shops: OwnedShop[] }) : { shops: [] }))
      .then((body) => {
        if (!cancelled) setShops(body.shops);
      })
      .catch(() => {
        if (!cancelled) setShops([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  /** Réglages modifiés par rapport à l'état serveur, au format de la commande updateSettings. */
  function changes(): Record<string, unknown> | null {
    const out: Record<string, unknown> = {};
    const startsAt = fromLocalInput(draft.startsAt);
    if (startsAt !== tournament.startsAt) {
      out.startsAt = startsAt;
      out.timeZone = startsAt ? (browserTimeZone() ?? tournament.timeZone) : null;
    }
    if (!samePlace(draft.place, tournament.place)) out.place = draft.place;
    const feeText = draft.fee.trim().replace(",", ".");
    const fee = feeText ? Math.round(Number(feeText) * 100) : null;
    if (fee !== null && (!Number.isFinite(fee) || fee <= 0)) {
      setError(t("publicTournaments.invalidFee"));
      return null;
    }
    if (fee !== tournament.entryFeeCents) out.entryFeeCents = fee;
    if (draft.currency !== tournament.currency) out.currency = draft.currency;
    const max = draft.maxPlayers.trim() ? Number(draft.maxPlayers) : null;
    if (max !== null && (!Number.isInteger(max) || max < 2 || max > 512)) {
      setError(t("publicTournaments.invalidMaxPlayers"));
      return null;
    }
    if (max !== tournament.maxPlayers) out.maxPlayers = max;
    if ((draft.description.trim() || null) !== tournament.description) out.description = draft.description;
    if ((draft.prizes.trim() || null) !== tournament.prizes) out.prizes = draft.prizes;
    return out;
  }

  async function save(event?: React.FormEvent) {
    event?.preventDefault();
    setError(null);
    const changed = changes();
    if (changed === null) return false;
    if (!Object.keys(changed).length) return true;
    const outcome = await run({ type: "updateSettings", settings: changed });
    return outcome.status !== "error";
  }

  async function publish() {
    if (!(await save())) return;
    await run({ type: "setVisibility", public: true });
  }

  const publicPath = { pathname: "/tournois/publics/[id]", params: { id: tournament.id } } as const;

  return (
    <form className={`${panelClass} flex flex-col gap-3`} onSubmit={(event) => void save(event)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg">{t("publicTournaments.publicationTitle")}</h2>
        <Tag tone={isPublic ? "cyan" : "muted"}>{isPublic ? t("publicTournaments.isPublic") : t("publicTournaments.isPrivate")}</Tag>
      </div>
      <p className="text-sm text-muted">{t("publicTournaments.publicationHint")}</p>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="hud-label">{t("publicTournaments.startsAtLabel")}</span>
          <input type="datetime-local" className={inputClass} value={draft.startsAt} disabled={readOnly} onChange={(event) => set("startsAt", event.target.value)} />
          {tournament.timeZone ? <span className="text-xs text-muted">{t("publicTournaments.localTime", { tz: tournament.timeZone })}</span> : null}
        </label>
        <label className="flex flex-col gap-1">
          <span className="hud-label">{t("publicTournaments.maxPlayers")}</span>
          <input
            type="number"
            inputMode="numeric"
            min={2}
            max={512}
            className={inputClass}
            value={draft.maxPlayers}
            disabled={readOnly}
            onChange={(event) => set("maxPlayers", event.target.value)}
          />
          <span className="text-xs text-muted">{t("publicTournaments.maxPlayersHint")}</span>
        </label>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label className="flex flex-col gap-1">
            <span className="hud-label">{t("publicTournaments.entryFeeLabel")}</span>
            <input
              inputMode="decimal"
              className={inputClass}
              value={draft.fee}
              placeholder={t("publicTournaments.free")}
              disabled={readOnly}
              onChange={(event) => set("fee", event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="hud-label">{t("publicTournaments.currency")}</span>
            <select className={inputClass} value={draft.currency} disabled={readOnly} onChange={(event) => set("currency", event.target.value)}>
              {TOURNAMENT_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="hud-label">{t("publicTournaments.shopLabel")}</span>
          <select
            className={inputClass}
            value={tournament.shop?.id ?? ""}
            disabled={readOnly || shops === null}
            onChange={(event) => void run({ type: "setShop", shopId: event.target.value || null })}
          >
            <option value="">{t("publicTournaments.noShop")}</option>
            {tournament.shop && !shops?.some((shop) => shop.id === tournament.shop?.id) ? (
              <option value={tournament.shop.id}>{tournament.shop.name}</option>
            ) : null}
            {shops
              ?.filter((shop) => shop.status !== "rejected")
              .map((shop) => (
                <option key={shop.id} value={shop.id}>
                  {shop.name}
                </option>
              ))}
          </select>
          <span className="text-xs text-muted">
            {t("publicTournaments.shopHint")}{" "}
            <Link href="/compte/boutique" className="text-cyan underline">
              {t("publicTournaments.manageShop")}
            </Link>
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-1">
        <span className="hud-label">{t("publicTournaments.venue")}</span>
        <AddressField
          key={JSON.stringify(tournament.place)}
          value={draft.place}
          onChange={(place) => set("place", place)}
          disabled={readOnly}
          allowClear={!isPublic}
        />
      </div>

      <label className="flex flex-col gap-1">
        <span className="hud-label">{t("publicTournaments.descriptionLabel")}</span>
        <textarea
          className={`${inputClass} h-28 py-2`}
          value={draft.description}
          maxLength={2000}
          disabled={readOnly}
          onChange={(event) => set("description", event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="hud-label">{t("publicTournaments.prizesLabel")}</span>
        <textarea className={`${inputClass} h-20 py-2`} value={draft.prizes} maxLength={500} disabled={readOnly} onChange={(event) => set("prizes", event.target.value)} />
      </label>

      {!readOnly ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className={buttonClass}>
            {t("tournaments.save")}
          </button>
          {isPublic ? (
            <button
              type="button"
              className={buttonClass}
              onClick={() => {
                if (window.confirm(t("publicTournaments.confirmUnpublish"))) void run({ type: "setVisibility", public: false });
              }}
            >
              {t("publicTournaments.unpublish")}
            </button>
          ) : (
            <button type="button" className={primaryClass} onClick={() => void publish()}>
              {t("publicTournaments.publish")}
            </button>
          )}
        </div>
      ) : null}
      {isPublic ? (
        <Link href={publicPath} className="text-sm text-cyan underline">
          {t("publicTournaments.viewPublicPage")}
        </Link>
      ) : null}
    </form>
  );
}
