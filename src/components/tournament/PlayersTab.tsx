"use client";

import { useState } from "react";
import { useI18n } from "@/components/LocaleProvider";
import type { PlayerView, TournamentView } from "@/lib/tournament/view";
import type { RunCommand } from "./TournamentConsole";
import { absoluteUrl, buttonClass, dangerClass, inputClass, panelClass, primaryClass, QrCode, Tag } from "./ui";

export function PlayersTab({ view, run }: { view: TournamentView; run: RunCommand }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [showCode, setShowCode] = useState(view.players.length === 0);
  const [open, setOpen] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const code = view.tournament.code;
  const started = view.rounds.some((round) => round.status === "running" || round.status === "closed");
  const canAdd = view.tournament.status === "inscriptions" || view.tournament.status === "suisse";
  const pendingPlayers = view.players.filter((player) => player.status === "pending");
  const waitlisted = view.players
    .filter((player) => player.status === "waitlist")
    .sort((a, b) => (a.waitlistPosition ?? 0) - (b.waitlistPosition ?? 0));
  const players = view.players.filter((player) => player.status !== "pending" && player.status !== "waitlist");
  const maxPlayers = view.tournament.maxPlayers;
  const seatsTaken = view.players.filter((player) => player.status === "active" || player.status === "pending").length;
  const joinUrl = code ? absoluteUrl(`/t/${code}`) : "";

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const outcome = await run({ type: "addPlayer", name: trimmed });
    if (outcome.status !== "error") setName("");
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className={`${panelClass} flex flex-col gap-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg">{t.tournaments.showCode}</h2>
          <button type="button" className={buttonClass} onClick={() => setShowCode((value) => !value)} aria-expanded={showCode}>
            {showCode ? t.tournaments.close : t.tournaments.show}
          </button>
        </div>
        {showCode && code ? (
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <QrCode value={joinUrl} label={t.tournaments.showCode} />
            <div className="flex flex-col gap-2">
              <p className="font-mono text-4xl tracking-[0.3em] text-cyan">{code}</p>
              <p className="text-sm text-muted">{t.tournaments.codeHint}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={buttonClass} onClick={() => void copyLink()}>
                  {copied ? t.tournaments.linkCopied : t.tournaments.copyLink}
                </button>
                <button type="button" className={buttonClass} onClick={() => void run({ type: "regenerateCode" })}>
                  {t.tournaments.regenerateCode}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Tag tone={view.tournament.registrationOpen ? "cyan" : "danger"}>
            {view.tournament.registrationOpen ? t.tournaments.registrationOpen : t.tournaments.registrationClosed}
          </Tag>
          <button
            type="button"
            className={buttonClass}
            onClick={() => void run({ type: "setRegistration", open: !view.tournament.registrationOpen })}
          >
            {view.tournament.registrationOpen ? t.tournaments.closeRegistration : t.tournaments.openRegistration}
          </button>
        </div>
      </section>

      {canAdd ? (
        <form className="flex gap-2" onSubmit={(event) => void add(event)}>
          <input
            className={inputClass}
            value={name}
            maxLength={32}
            placeholder={t.tournaments.playerName}
            aria-label={t.tournaments.playerName}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className={primaryClass}>
            {t.tournaments.add}
          </button>
        </form>
      ) : null}

      {pendingPlayers.length ? (
        <section className={`${panelClass} flex flex-col gap-2`}>
          <h2 className="hud-label">{t.tournaments.pending}</h2>
          {pendingPlayers.map((player) => (
            <div key={player.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>{player.name}</span>
              <span className="flex gap-2">
                <button type="button" className={primaryClass} onClick={() => void run({ type: "approvePlayer", playerId: player.id })}>
                  {t.tournaments.approve}
                </button>
                <button type="button" className={dangerClass} onClick={() => void run({ type: "rejectPlayer", playerId: player.id })}>
                  {t.tournaments.reject}
                </button>
              </span>
            </div>
          ))}
        </section>
      ) : null}

      {waitlisted.length ? (
        <section className={`${panelClass} flex flex-col gap-2`}>
          <h2 className="hud-label">
            {t.publicTournaments.waitlistTitle} · {waitlisted.length}
          </h2>
          {waitlisted.map((player) => (
            <div key={player.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="mr-2 font-mono text-muted">{player.waitlistPosition}</span>
                {player.name}
              </span>
              {canAdd ? (
                <span className="flex gap-2">
                  <button type="button" className={buttonClass} onClick={() => void run({ type: "promoteWaitlisted", playerId: player.id })}>
                    {t.publicTournaments.promote}
                  </button>
                  <button type="button" className={dangerClass} onClick={() => void run({ type: "removePlayer", playerId: player.id })}>
                    {t.tournaments.remove}
                  </button>
                </span>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col">
        <h2 className="hud-label mb-2">
          {t.tournaments.playerCount(players.length)}
          {maxPlayers !== null ? ` · ${t.publicTournaments.capacityLine(seatsTaken, maxPlayers)}` : ""}
        </h2>
        {players.length === 0 ? <p className="text-sm text-muted">{t.tournaments.noPlayers}</p> : null}
        <ul className="flex flex-col border-t border-line">
          {players.map((player) => (
            <PlayerRow
              key={player.id}
              player={player}
              view={view}
              run={run}
              started={started}
              open={open === player.id}
              onToggle={() => setOpen((current) => (current === player.id ? null : player.id))}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}

type Mode = "none" | "rename" | "dq" | "merge" | "qr";

function PlayerRow({
  player,
  view,
  run,
  started,
  open,
  onToggle,
}: {
  player: PlayerView;
  view: TournamentView;
  run: RunCommand;
  started: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("none");
  const [text, setText] = useState("");
  const [claim, setClaim] = useState<{ token: string; expiresAt: string } | null>(null);
  const others = view.players.filter(
    (candidate) => candidate.id !== player.id && candidate.status !== "pending" && candidate.status !== "waitlist",
  );
  const swissOver = view.tournament.status !== "inscriptions" && view.tournament.status !== "suisse";

  async function issueClaim() {
    const outcome = await run({ type: "issueClaim", playerId: player.id });
    if (outcome.status === "ok" && outcome.result.data?.token) {
      setClaim({ token: outcome.result.data.token as string, expiresAt: outcome.result.data.expiresAt as string });
      setMode("qr");
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    const command =
      mode === "rename"
        ? { type: "renamePlayer", playerId: player.id, name: text.trim() }
        : { type: "disqualify", playerId: player.id, reason: text.trim() };
    const outcome = await run(command);
    if (outcome.status !== "error") {
      setMode("none");
      setText("");
    }
  }

  return (
    <li className="border-b border-line">
      <button type="button" className="flex min-h-12 w-full items-center justify-between gap-2 px-1 py-2 text-left" aria-expanded={open} onClick={onToggle}>
        <span className="flex flex-wrap items-center gap-1">
          <span className="mr-1">{player.name}</span>
          {player.isAccount ? <Tag tone="cyan">{t.tournaments.account}</Tag> : player.hasApp ? <Tag tone="cyan">{t.tournaments.withApp}</Tag> : <Tag>{t.tournaments.paper}</Tag>}
          {player.status === "dropped" ? <Tag>{t.tournaments.dropped}</Tag> : null}
          {player.status === "dq" ? <Tag tone="danger">{t.tournaments.dq}</Tag> : null}
          {player.joinedRound > 1 ? <span className="text-xs text-muted">{t.tournaments.joinedRound(player.joinedRound)}</span> : null}
        </span>
        <span aria-hidden="true" className="text-muted">
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? (
        <div className="flex flex-col gap-3 px-1 pb-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass} onClick={() => void issueClaim()}>
              {t.tournaments.personalQr}
            </button>
            <button type="button" className={buttonClass} onClick={() => { setMode("rename"); setText(player.name); }}>
              {t.tournaments.rename}
            </button>
            {others.length ? (
              <button type="button" className={buttonClass} onClick={() => setMode("merge")}>
                {t.tournaments.merge}
              </button>
            ) : null}
            {!started ? (
              <button type="button" className={dangerClass} onClick={() => void run({ type: "removePlayer", playerId: player.id })}>
                {t.tournaments.remove}
              </button>
            ) : null}
            {started && player.status === "active" ? (
              <button type="button" className={dangerClass} onClick={() => void run({ type: "dropPlayer", playerId: player.id })}>
                {t.tournaments.drop}
              </button>
            ) : null}
            {player.status === "dropped" && !swissOver ? (
              <button type="button" className={buttonClass} onClick={() => void run({ type: "undropPlayer", playerId: player.id })}>
                {t.tournaments.undrop}
              </button>
            ) : null}
            {started && player.status !== "dq" ? (
              <button type="button" className={dangerClass} onClick={() => { setMode("dq"); setText(""); }}>
                {t.tournaments.disqualify}
              </button>
            ) : null}
          </div>

          {mode === "qr" && claim ? (
            <div className="flex flex-col items-center gap-2 sm:items-start">
              <QrCode value={absoluteUrl(`/t/claim/${claim.token}`)} label={t.tournaments.personalQr} />
              <p className="max-w-sm text-sm text-muted">{t.tournaments.personalQrHint(player.name)}</p>
            </div>
          ) : null}

          {mode === "rename" || mode === "dq" ? (
            <form className="flex gap-2" onSubmit={(event) => void submit(event)}>
              <input
                className={inputClass}
                value={text}
                maxLength={mode === "rename" ? 32 : 200}
                placeholder={mode === "rename" ? t.tournaments.playerName : t.tournaments.dqReason}
                aria-label={mode === "rename" ? t.tournaments.playerName : t.tournaments.dqReason}
                onChange={(event) => setText(event.target.value)}
                autoFocus
              />
              <button type="submit" className={mode === "dq" ? dangerClass : primaryClass}>
                {t.tournaments.confirm}
              </button>
              <button type="button" className={buttonClass} onClick={() => setMode("none")}>
                {t.tournaments.cancel}
              </button>
            </form>
          ) : null}

          {mode === "merge" ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted">{t.tournaments.mergeHint(player.name)}</p>
              <div className="flex flex-wrap gap-2">
                {others.map((other) => (
                  <button
                    key={other.id}
                    type="button"
                    className={buttonClass}
                    onClick={async () => {
                      if (!window.confirm(t.tournaments.mergeConfirm(other.name, player.name))) return;
                      const outcome = await run({ type: "mergePlayers", keepId: player.id, mergeId: other.id });
                      if (outcome.status !== "error") setMode("none");
                    }}
                  >
                    {other.name}
                  </button>
                ))}
                <button type="button" className={buttonClass} onClick={() => setMode("none")}>
                  {t.tournaments.cancel}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
