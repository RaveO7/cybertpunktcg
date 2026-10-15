"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { Translator } from "@/i18n/translator";
import type { CommandWarning } from "@/lib/tournament/commands";
import type { TournamentView } from "@/lib/tournament/view";
import { useOrganizerActions, useServerNow, useTournamentState, type ActionOutcome } from "./hooks";
import { PlayersTab } from "./PlayersTab";
import { RoundTab } from "./RoundTab";
import { SettingsTab } from "./SettingsTab";
import { FinalStandings, panelClass, StandingsTable, Tag } from "./ui";

type Tab = "players" | "round" | "standings" | "settings";

export type Notice = { tone: "info" | "error"; text: string };

/** Exécute une commande organisateur et traduit le résultat en message pour l'écran. */
export type RunCommand = (command: { type: string } & Record<string, unknown>) => Promise<ActionOutcome>;

export function warningText(warning: CommandWarning, view: TournamentView, t: Translator) {
  const name = (id: string) => view.players.find((player) => player.id === id)?.name ?? "?";
  switch (warning.type) {
    case "rematch":
      return t("tournaments.rematch", { a: name(warning.a), b: name(warning.b) });
    case "second_bye":
      return t("tournaments.secondBye", { name: name(warning.playerId) });
    case "draft_outdated":
      return t("tournaments.draftOutdated");
    case "correction_after_pairing":
      return t("tournaments.correctionWarning");
  }
}

export function TournamentConsole({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations();
  const { view, error, offsetMs, refresh } = useTournamentState(tournamentId);
  const { act, pending, conflicts, dismissConflict } = useOrganizerActions(tournamentId, refresh);
  const now = useServerNow(offsetMs);
  const [tab, setTab] = useState<Tab | null>(null);
  const [notices, setNotices] = useState<Notice[]>([]);

  const run: RunCommand = useCallback(
    async (command) => {
      const outcome = await act(command);
      if (outcome.status === "error") setNotices([{ tone: "error", text: outcome.error }]);
      else if (outcome.status === "ok" && view) {
        const warnings = outcome.result.warnings ?? [];
        setNotices(warnings.map((warning) => ({ tone: "info" as const, text: warningText(warning, view, t) })));
      } else setNotices([]);
      return outcome;
    },
    [act, view, t],
  );

  if (error === "notFound") return <Centered>{t("tournaments.notFound")}</Centered>;
  if (!view) return <Centered>{error === "failed" ? t("tournaments.loadFailed") : t("common.loading")}</Centered>;
  if (view.role !== "organizer") {
    return (
      <Centered>
        <p>{t("tournaments.organizersOnly")}</p>
        {view.tournament.code ? (
          <Link className="mt-3 inline-block text-cyan underline" href={{ pathname: "/t/[code]", params: { code: view.tournament.code } }}>
            {t("tournaments.openPlayerView")}
          </Link>
        ) : null}
      </Centered>
    );
  }

  const current: Tab = tab ?? (view.tournament.status === "inscriptions" && view.rounds.length === 0 ? "players" : "round");
  const tabs: { id: Tab; label: string }[] = [
    { id: "players", label: t("tournaments.tabs.players") },
    { id: "round", label: t("tournaments.tabs.round") },
    { id: "standings", label: t("tournaments.tabs.standings") },
    { id: "settings", label: t("tournaments.tabs.settings") },
  ];
  const corrections = view.logs.filter((log) => log.action === "correct_after");

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-[1100px] flex-col gap-4 px-3 py-4 sm:px-4 sm:py-6">
      <div className="flex flex-col gap-1">
        <Link href="/tournois" className="text-xs text-muted hover:text-foreground">
          ← {t("tournaments.back")}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl text-yellow sm:text-3xl">{view.tournament.name}</h1>
          <Tag tone="cyan">{t(`tournaments.statuses.${view.tournament.status}`)}</Tag>
          {view.tournament.code ? <span className="font-mono text-lg tracking-[0.25em] text-cyan">{view.tournament.code}</span> : null}
        </div>
        <SyncStatus pending={pending.length} offline={error === "failed"} />
      </div>

      {conflicts.map((conflict) => (
        <div key={conflict.clientActionId} role="alert" className="flex items-center justify-between gap-2 border border-danger/60 bg-panel p-2 text-sm text-danger">
          <span>{t("tournaments.conflict", { error: conflict.error })}</span>
          <button type="button" className="text-xs underline" onClick={() => dismissConflict(conflict.clientActionId)}>
            {t("tournaments.dismiss")}
          </button>
        </div>
      ))}
      {notices.map((notice, index) => (
        <p key={index} role={notice.tone === "error" ? "alert" : "status"} className={`text-sm ${notice.tone === "error" ? "text-danger" : "text-yellow"}`}>
          {notice.text}
        </p>
      ))}

      <nav className="flex border border-line" aria-label={t("tournaments.title")}>
        {tabs.map((entry) => (
          <button
            key={entry.id}
            type="button"
            aria-current={current === entry.id ? "page" : undefined}
            className={`h-11 flex-1 text-sm ${current === entry.id ? "bg-panel-2 text-yellow" : "text-muted hover:text-foreground"}`}
            onClick={() => {
              setTab(entry.id);
              setNotices([]);
            }}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {current === "players" ? <PlayersTab view={view} run={run} /> : null}
      {current === "round" ? <RoundTab view={view} run={run} now={now} pending={pending} /> : null}
      {current === "standings" ? (
        <div className="flex flex-col gap-3">
          <FinalStandings view={view} />
          {corrections.length ? <p className="text-sm text-yellow">{t("tournaments.correctionWarning")}</p> : null}
          {view.tournament.cutDraws.map((draw) => (
            <p key={draw.at} className="text-sm text-muted">
              {t("tournaments.drawTitle")} · {t("tournaments.drawLine", { picked: draw.picked.length, tied: draw.tied.length })} ·{" "}
              {draw.picked.map((id) => view.players.find((player) => player.id === id)?.name ?? "?").join(", ")}
            </p>
          ))}
          <section className={panelClass}>
            <StandingsTable standings={view.standings} players={view.players} view={view} />
          </section>
        </div>
      ) : null}
      {current === "settings" ? <SettingsTab view={view} run={run} /> : null}
    </div>
  );
}

function SyncStatus({ pending, offline }: { pending: number; offline: boolean }) {
  const t = useTranslations();
  if (pending > 0) return <p className="text-xs text-danger">{t("tournaments.unsynced", { n: pending })}</p>;
  if (offline) return <p className="text-xs text-danger">{t("tournaments.offline")}</p>;
  return <p className="text-xs text-muted">{t("tournaments.synced")}</p>;
}

export function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-sm text-muted">{children}</div>;
}
