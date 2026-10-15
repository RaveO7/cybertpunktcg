"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { intlLocale } from "@/i18n/config";
import { normalizeTournamentCode } from "@/lib/tournament/code";
import { ApiError, postJson } from "./hooks";
import { inputClass, panelClass, primaryClass, Tag } from "./ui";

type TournamentRow = {
  id: string;
  code: string;
  name: string;
  status: "inscriptions" | "suisse" | "top_cut" | "termine" | "annule";
  format: "boutique" | "competitif";
  createdAt: string;
  role: "owner" | "co" | null;
  playerCount: number;
};

export function TournamentsScreen() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [rows, setRows] = useState<TournamentRow[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [name, setName] = useState("");
  const [format, setFormat] = useState<"boutique" | "competitif">("boutique");
  const [matchType, setMatchType] = useState<"bo1" | "bo3">("bo3");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/tournaments", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("list");
        const body = (await response.json()) as { tournaments: TournamentRow[] };
        if (!cancelled) setRows(body.tournaments);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const { tournament } = await postJson<{ tournament: { id: string } }>("/api/tournaments", {
        name: name.trim() || t("tournaments.defaultName"),
        format,
        matchType,
      });
      router.push({ pathname: "/tournois/[id]", params: { id: tournament.id } });
    } catch (error) {
      setMessage(error instanceof ApiError && error.status === 0 ? t("tournaments.offline") : error instanceof Error ? error.message : t("tournaments.failed"));
      setPending(false);
    }
  }

  function join(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeTournamentCode(code);
    if (!normalized) {
      setMessage(t("tournaments.invalidCode"));
      return;
    }
    router.push({ pathname: "/t/[code]", params: { code: normalized } });
  }

  const dateFormat = new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: "medium" });

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1100px] flex-col gap-5 px-3 py-4 sm:gap-6 sm:px-4 sm:py-6">
      <div>
        <h1 className="text-2xl text-yellow sm:text-4xl">{t("tournaments.title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t("tournaments.subtitle")}</p>
      </div>
      {message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}

      <Link href="/tournois/publics" className={`${panelClass} flex flex-col gap-1 border-cyan/50 transition hover:border-cyan`}>
        <span className="text-lg text-cyan">{t("publicTournaments.browse")} →</span>
        <span className="text-sm text-muted">{t("publicTournaments.browseHint")}</span>
      </Link>
      <p className="flex flex-wrap gap-4 text-sm">
        <Link href="/boutiques" className="text-cyan underline">
          {t("publicTournaments.shopsLink")}
        </Link>
        <Link href="/compte/boutique" className="text-cyan underline">
          {t("publicTournaments.myShopLink")}
        </Link>
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <form className={`${panelClass} flex flex-col gap-3`} onSubmit={join}>
          <h2 className="text-lg">{t("tournaments.joinTitle")}</h2>
          <p className="text-sm text-muted">{t("tournaments.joinHint")}</p>
          <label className="flex flex-col gap-1">
            <span className="hud-label">{t("tournaments.codeLabel")}</span>
            <input
              className={`${inputClass} font-mono text-lg uppercase tracking-[0.3em]`}
              value={code}
              maxLength={8}
              autoCapitalize="characters"
              autoComplete="off"
              inputMode="text"
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <button type="submit" className={primaryClass}>
            {t("tournaments.joinButton")}
          </button>
        </form>

        <form className={`${panelClass} flex flex-col gap-3`} onSubmit={(event) => void create(event)}>
          <h2 className="text-lg">{t("tournaments.createTitle")}</h2>
          <label className="flex flex-col gap-1">
            <span className="hud-label">{t("tournaments.name")}</span>
            <input className={inputClass} value={name} maxLength={60} placeholder={t("tournaments.defaultName")} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="hud-label">{t("tournaments.formatLabel")}</span>
              <select className={inputClass} value={format} onChange={(event) => setFormat(event.target.value as typeof format)}>
                <option value="boutique">{t("tournaments.formats.boutique")}</option>
                <option value="competitif">{t("tournaments.formats.competitif")}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="hud-label">{t("tournaments.matchTypeLabel")}</span>
              <select className={inputClass} value={matchType} onChange={(event) => setMatchType(event.target.value as typeof matchType)}>
                <option value="bo3">{t("tournaments.bo3")}</option>
                <option value="bo1">{t("tournaments.bo1")}</option>
              </select>
            </label>
          </div>
          <p className="text-xs text-muted">{format === "boutique" ? t("tournaments.boutiqueHint") : t("tournaments.competitiveHint")}</p>
          <button type="submit" className={primaryClass} disabled={pending}>
            {t("tournaments.create")}
          </button>
        </form>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg">{t("tournaments.mine")}</h2>
        {loadError ? <p className="text-sm text-danger">{t("tournaments.loadFailed")}</p> : null}
        {rows === null && !loadError ? <p className="text-sm text-muted">{t("common.loading")}</p> : null}
        {rows?.length === 0 ? <p className={`${panelClass} text-sm text-muted`}>{t("tournaments.empty")}</p> : null}
        {rows && rows.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.role ? { pathname: "/tournois/[id]", params: { id: row.id } } : { pathname: "/t/[code]", params: { code: row.code } }}
                  className="flex h-full flex-col gap-2 border border-line bg-panel p-3 transition hover:border-cyan"
                >
                  <span className="text-base">{row.name}</span>
                  <span className="flex flex-wrap items-center gap-1">
                    <Tag tone={row.status === "termine" || row.status === "annule" ? "muted" : "cyan"}>{t(`tournaments.statuses.${row.status}`)}</Tag>
                    <Tag>{t(`tournaments.formats.${row.format}`)}</Tag>
                    <Tag tone="yellow">{row.role === "owner" ? t("tournaments.organizer") : row.role === "co" ? t("tournaments.coOrganizer") : t("tournaments.player")}</Tag>
                  </span>
                  <span className="text-xs text-muted">
                    {t("tournaments.playerCount", { n: row.playerCount })} · {dateFormat.format(new Date(row.createdAt))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
