"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/components/LocaleProvider";
import { TOP_CUT_SETTINGS, type TopCutSetting } from "@/lib/tournament/top-cut";
import type { TournamentView } from "@/lib/tournament/view";
import type { RunCommand } from "./TournamentConsole";
import { absoluteUrl, buttonClass, dangerClass, inputClass, panelClass, primaryClass, Tag } from "./ui";

type Draft = TournamentView["tournament"];

export function SettingsTab({ view, run }: { view: TournamentView; run: RunCommand }) {
  const { t } = useI18n();
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(view.tournament);
  const [invite, setInvite] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isOwner = view.organizerRole === "owner";
  const settings = view.tournament;
  const started = view.rounds.some((round) => round.status === "running" || round.status === "closed");
  const cutLocked = settings.status !== "inscriptions" && settings.status !== "suisse";
  const readOnly = settings.status === "termine" || settings.status === "annule";

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const changed: Record<string, unknown> = {};
    const keys = [
      "name",
      "format",
      "matchType",
      "roundMinutes",
      "topCutExtraMinutes",
      "topCutSetting",
      "requireApproval",
      "oneDeviceMode",
      "declareTimeoutMinutes",
      "lateEntryPolicy",
      "swissRounds",
    ] as const;
    for (const key of keys) if (draft[key] !== settings[key]) changed[key] = draft[key];
    if (Object.keys(changed).length) await run({ type: "updateSettings", settings: changed });
  }

  async function createInvite() {
    const outcome = await run({ type: "inviteOrganizer" });
    if (outcome.status === "ok" && outcome.result.data?.token) setInvite(absoluteUrl(`/tournois/invitation/${outcome.result.data.token as string}`));
  }

  async function remove() {
    if (!window.confirm(t.tournaments.confirmDelete)) return;
    const response = await fetch(`/api/tournaments/${settings.id}`, { method: "DELETE" }).catch(() => null);
    if (response?.ok) router.push("/tournois");
    else setError(t.tournaments.failed);
  }

  const numberField = (key: "roundMinutes" | "topCutExtraMinutes" | "declareTimeoutMinutes" | "swissRounds", label: string, min: number, max: number, disabled = false) => (
    <label className="flex flex-col gap-1">
      <span className="hud-label">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        className={inputClass}
        value={draft[key]}
        disabled={disabled || readOnly}
        onChange={(event) => set(key, Number(event.target.value))}
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <form className={`${panelClass} grid gap-3 sm:grid-cols-2`} onSubmit={(event) => void save(event)}>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="hud-label">{t.tournaments.name}</span>
          <input className={inputClass} value={draft.name} maxLength={60} disabled={readOnly} onChange={(event) => set("name", event.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="hud-label">
            {t.tournaments.formatLabel} {started ? <Tag>{t.tournaments.frozen}</Tag> : null}
          </span>
          <select className={inputClass} value={draft.format} disabled={started || readOnly} onChange={(event) => set("format", event.target.value as Draft["format"])}>
            <option value="boutique">{t.tournaments.formats.boutique}</option>
            <option value="competitif">{t.tournaments.formats.competitif}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="hud-label">
            {t.tournaments.matchTypeLabel} {started ? <Tag>{t.tournaments.frozen}</Tag> : null}
          </span>
          <select className={inputClass} value={draft.matchType} disabled={started || readOnly} onChange={(event) => set("matchType", event.target.value as Draft["matchType"])}>
            <option value="bo3">{t.tournaments.bo3}</option>
            <option value="bo1">{t.tournaments.bo1}</option>
          </select>
        </label>
        {numberField("roundMinutes", t.tournaments.roundMinutes, 10, 180)}
        {started ? numberField("swissRounds", t.tournaments.swissRounds, 1, 20, settings.status !== "suisse") : null}
        <label className="flex flex-col gap-1">
          <span className="hud-label">{t.tournaments.topCut}</span>
          <select className={inputClass} value={draft.topCutSetting} disabled={cutLocked || readOnly} onChange={(event) => set("topCutSetting", event.target.value as TopCutSetting)}>
            {TOP_CUT_SETTINGS.map((option) => (
              <option key={option} value={option}>
                {option === "aucun" ? t.tournaments.topCutNone : option === "auto" ? t.tournaments.topCutAuto : t.tournaments.topCutSize(Number(option))}
              </option>
            ))}
          </select>
        </label>
        {numberField("topCutExtraMinutes", t.tournaments.topCutExtraMinutes, 0, 120)}
        <label className="flex flex-col gap-1">
          <span className="hud-label">{t.tournaments.oneDeviceMode}</span>
          <select className={inputClass} value={draft.oneDeviceMode} disabled={readOnly} onChange={(event) => set("oneDeviceMode", event.target.value as Draft["oneDeviceMode"])}>
            <option value="direct">{t.tournaments.oneDeviceDirect}</option>
            <option value="organizer">{t.tournaments.oneDeviceOrganizer}</option>
          </select>
        </label>
        {numberField("declareTimeoutMinutes", t.tournaments.declareTimeout, 1, 120)}
        <label className="flex flex-col gap-1">
          <span className="hud-label">
            {t.tournaments.latePolicy} {started ? <Tag>{t.tournaments.frozen}</Tag> : null}
          </span>
          <select className={inputClass} value={draft.lateEntryPolicy} disabled={started || readOnly} onChange={(event) => set("lateEntryPolicy", event.target.value as Draft["lateEntryPolicy"])}>
            <option value="zero">{t.tournaments.lateZero}</option>
            <option value="loss">{t.tournaments.lateLoss}</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={draft.requireApproval} disabled={readOnly} onChange={(event) => set("requireApproval", event.target.checked)} />
          {t.tournaments.requireApproval}
        </label>
        {!readOnly ? (
          <div className="sm:col-span-2">
            <button type="submit" className={primaryClass}>
              {t.tournaments.save}
            </button>
          </div>
        ) : null}
      </form>

      <section className={`${panelClass} flex flex-col gap-2`}>
        <h2 className="text-lg">{t.tournaments.organizers}</h2>
        <ul className="flex flex-col gap-1 text-sm">
          {view.organizers.map((organizer) => (
            <li key={organizer.userId} className="flex items-center justify-between gap-2">
              <span>
                {organizer.name} <Tag tone="yellow">{organizer.role === "owner" ? t.tournaments.organizer : t.tournaments.coOrganizer}</Tag>
              </span>
              {isOwner && organizer.role !== "owner" ? (
                <button type="button" className={buttonClass} onClick={() => void run({ type: "removeOrganizer", userId: organizer.userId })}>
                  {t.tournaments.remove}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {isOwner ? (
          <>
            <button type="button" className={buttonClass} onClick={() => void createInvite()}>
              {t.tournaments.invite}
            </button>
            {invite ? (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted">{t.tournaments.inviteHint}</p>
                <input className={`${inputClass} font-mono text-xs`} readOnly value={invite} onFocus={(event) => event.target.select()} />
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      {isOwner ? (
        <section className={`${panelClass} flex flex-wrap gap-2`}>
          {!readOnly ? (
            <button
              type="button"
              className={dangerClass}
              onClick={() => {
                if (window.confirm(t.tournaments.confirmCancel)) void run({ type: "cancel" });
              }}
            >
              {t.tournaments.cancelTournament}
            </button>
          ) : null}
          <button type="button" className={dangerClass} onClick={() => void remove()}>
            {t.tournaments.deleteTournament}
          </button>
        </section>
      ) : null}
    </div>
  );
}
