// Notifications push des joueurs d'un tournoi : ronde appariée (table et adversaire), inscription
// validée, tournoi terminé ou annulé. Les évènements se déduisent de l'état du tournoi avant et après
// une commande organisateur, puis sont envoyés une fois la transaction validée (src/lib/push.ts).
// Seuls les joueurs liés à un compte peuvent être prévenus : l'abonnement push appartient au compte.
import type { PrismaClient } from "@prisma/client";
import type { OrganizerCommand } from "@/lib/api-schemas";
import type { Locale } from "@/i18n/config";
import { routePath } from "@/i18n/paths";
import { translatorFor } from "@/i18n/server";
import { reportError } from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { sendToUsers, type PushOptions, type PushPayload, type PushReport } from "@/lib/push";
import type { FullTournament } from "./repository";
import { tournamentStandings } from "./service";

type EventBase = { userId: string; tournamentId: string; code: string; tournamentName: string };

export type TournamentEvent =
  | (EventBase & {
      kind: "round";
      phase: "swiss" | "top_cut";
      number: number;
      started: boolean;
      /** `null` : bye. */
      table: number | null;
      opponent: string | null;
    })
  | (EventBase & { kind: "approved" })
  | (EventBase & { kind: "ended"; champion: boolean; rank: number | null })
  | (EventBase & { kind: "cancelled" });

/**
 * Commandes qui peuvent produire un évènement : on ne relit le tournoi qu'après celles-ci. Les commandes
 * qui libèrent une place peuvent valider un joueur en liste d'attente ; un drop ou un déclin peut finir
 * le tournoi (top cut vide).
 */
export const NOTIFYING_COMMANDS: ReadonlySet<OrganizerCommand["type"]> = new Set([
  "publishRound",
  "startRound",
  "closeRound",
  "approvePlayer",
  "promoteWaitlisted",
  "cancel",
  "declineCut",
  "updateSettings",
  "setRegistration",
  "removePlayer",
  "rejectPlayer",
  "mergePlayers",
  "dropPlayer",
  "disqualify",
  "noShow",
]);

/** Gardées 2 h par le service push si l'appareil est éteint : au-delà, une ronde est déjà finie. */
const TOURNAMENT_TTL_SECONDS = 2 * 60 * 60;
const VISIBLE_ROUND = new Set(["published", "running"]);

/** Évènements à envoyer, d'après l'état avant et après la commande. L'auteur de la commande n'est pas prévenu. */
export function tournamentEvents(before: FullTournament, after: FullTournament, actorUserId: string): TournamentEvent[] {
  const base = { tournamentId: after.id, code: after.code, tournamentName: after.name };
  const playersBefore = new Map(before.players.map((player) => [player.id, player]));
  const players = new Map(after.players.map((player) => [player.id, player]));
  const events: TournamentEvent[] = [];

  const roundsBefore = new Map(before.rounds.map((round) => [round.id, round.status]));
  for (const round of after.rounds) {
    const previous = roundsBefore.get(round.id);
    const appeared = VISIBLE_ROUND.has(round.status) && !VISIBLE_ROUND.has(previous ?? "draft");
    const started = round.status === "running" && previous === "published";
    if (!appeared && !started) continue;
    for (const match of round.matches) {
      const sides = [
        [match.playerAId, match.playerBId],
        [match.playerBId, match.playerAId],
      ] as const;
      for (const [selfId, opponentId] of sides) {
        const userId = selfId ? players.get(selfId)?.userId : null;
        if (!userId) continue;
        events.push({
          ...base,
          userId,
          kind: "round",
          phase: round.phase === "top_cut" ? "top_cut" : "swiss",
          number: round.number,
          started: round.status === "running",
          table: opponentId ? match.table : null,
          opponent: opponentId ? (players.get(opponentId)?.name ?? null) : null,
        });
      }
    }
  }

  for (const player of after.players) {
    const previous = playersBefore.get(player.id)?.status;
    if (player.userId && player.status === "active" && (previous === "pending" || previous === "waitlist")) {
      events.push({ ...base, userId: player.userId, kind: "approved" });
    }
  }

  if (after.status === "termine" && before.status !== "termine") {
    // Sans top cut, le classement suisse est le classement final ; avec, seul le champion est annoncé.
    const ranks = after.cutJson ? null : new Map(tournamentStandings(after).map((row) => [row.playerId, row.rank]));
    for (const player of after.players) {
      if (!player.userId || player.status !== "active") continue;
      events.push({
        ...base,
        userId: player.userId,
        kind: "ended",
        champion: after.championId === player.id,
        rank: ranks?.get(player.id) ?? null,
      });
    }
  }

  if (after.status === "annule" && before.status !== "annule") {
    for (const player of after.players) {
      if (player.userId && ["active", "pending", "waitlist"].includes(player.status)) {
        events.push({ ...base, userId: player.userId, kind: "cancelled" });
      }
    }
  }

  return events.filter((event) => event.userId !== actorUserId);
}

/** Texte d'un évènement dans la langue de l'appareil ; le tag du tournoi remplace la notification précédente. */
export async function tournamentEventPayload(locale: Locale, event: TournamentEvent): Promise<PushPayload> {
  const t = await translatorFor(locale, "tournaments");
  const url = routePath("/t/[code]", locale, { code: event.code });
  const tag = `tournament-${event.tournamentId}`;
  const title = event.tournamentName;
  switch (event.kind) {
    case "round": {
      const round = event.phase === "top_cut" ? t("push.topCut") : t("push.round", { number: event.number });
      const pairing =
        event.table === null
          ? t("push.bye")
          : t("push.pairing", { table: event.table, opponent: event.opponent ?? t("push.unknownOpponent") });
      const body = t(event.started ? "push.roundStarted" : "push.roundPublished", { round, pairing });
      return { title, body, url, tag };
    }
    case "approved":
      return { title, body: t("push.approved"), url, tag };
    case "ended":
      return {
        title,
        body: event.champion
          ? t("push.champion")
          : event.rank !== null
            ? t("push.endedRank", { rank: event.rank })
            : t("push.ended"),
        url,
        tag,
      };
    case "cancelled":
      return { title, body: t("push.cancelled"), url, tag };
  }
}

/**
 * Envoie les évènements, un seul par compte (le dernier : une ronde qui démarre remplace son appariement).
 * À appeler hors transaction, après la validation de la commande.
 */
export async function notifyTournamentEvents(
  client: PrismaClient,
  events: TournamentEvent[],
  options: PushOptions = {},
): Promise<PushReport> {
  const byUser = new Map(events.map((event) => [event.userId, event]));
  const topic = `t${events[0]?.tournamentId ?? ""}`.slice(0, 32);
  return sendToUsers(
    client,
    [...byUser.keys()],
    (userId, locale) => tournamentEventPayload(locale, byUser.get(userId)!),
    { ttlSeconds: TOURNAMENT_TTL_SECONDS, topic },
    options,
  );
}

/** Envoi depuis une route, après la réponse : un échec est signalé sans toucher la commande, déjà validée. */
export async function sendTournamentNotifications(events: TournamentEvent[]) {
  try {
    await notifyTournamentEvents(prisma, events);
  } catch (error) {
    await reportError("tournament-push", error, { tournamentId: events[0]?.tournamentId });
  }
}
