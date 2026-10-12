// Vue d'un tournoi envoyée aux écrans, adaptée au rôle : l'organisateur voit tout (brouillons,
// inscriptions en attente, historique) ; un joueur ou un visiteur voit ce qui est publié.

import { placeFromRow, type Place } from "@/lib/geo/location";
import { waitlistPosition } from "./capacity";
import { isOverdue, type MatchStatus } from "./match-state";
import { findViewerPlayer, type Viewer } from "./player-auth";
import type { FullTournament, MatchRow } from "./repository";
import { toMatchState } from "./repository";
import type { MatchKind, MatchResult } from "./scores";
import { hasApp, organizerRole, readCut, readCutDraws, tournamentStandings, standingsMatches, type TournamentStatus } from "./service";
import { computeFinalStandings, type FinalStanding, type Standing } from "./standings";
import type { CutDraw } from "./top-cut";

export type ViewRole = "organizer" | "player" | "public";

export type PlayerView = {
  id: string;
  name: string;
  status: "pending" | "active" | "dropped" | "dq" | "waitlist";
  /** Rang dans la liste d'attente (1 = prochain promu), sinon null. */
  waitlistPosition: number | null;
  hasApp: boolean;
  isAccount: boolean;
  joinedRound: number;
  dqReason: string | null;
  cutDeclined: boolean;
};

export type MatchView = {
  id: string;
  table: number;
  slot: number | null;
  playerAId: string;
  playerBId: string | null;
  status: MatchStatus;
  kind: MatchKind;
  gamesA: number | null;
  gamesB: number | null;
  /** Déclarations : visibles des organisateurs et des deux joueurs du match. */
  declA: MatchResult | null;
  declB: MatchResult | null;
  declaredAt: string | null;
  confirmedOnSite: boolean;
  extraSeconds: number;
  version: number;
  overdue: boolean;
};

export type RoundView = {
  id: string;
  number: number;
  phase: "swiss" | "top_cut";
  status: "draft" | "published" | "running" | "closed";
  startedAt: string | null;
  durationSeconds: number;
  pausedAt: string | null;
  pausedSeconds: number;
  addedSeconds: number;
  matches: MatchView[];
};

export type MatchLogView = {
  id: string;
  matchId: string;
  action: string;
  actorUserId: string | null;
  actorPlayerId: string | null;
  before: unknown;
  after: unknown;
  at: string;
};

export type TournamentView = {
  revision: number;
  serverNow: string;
  role: ViewRole;
  /** Rôle d'organisateur de l'utilisateur, s'il en a un. */
  organizerRole: "owner" | "co" | null;
  me: PlayerView | null;
  tournament: {
    id: string;
    code: string | null;
    name: string;
    format: "boutique" | "competitif";
    matchType: "bo1" | "bo3";
    status: TournamentStatus;
    roundMinutes: number;
    topCutExtraMinutes: number;
    topCutSetting: string;
    swissRounds: number;
    registrationOpen: boolean;
    requireApproval: boolean;
    oneDeviceMode: "direct" | "organizer";
    declareTimeoutMinutes: number;
    lateEntryPolicy: "zero" | "loss";
    championId: string | null;
    cutSeeds: string[];
    cutDraws: CutDraw[];
    visibility: "private" | "public";
    startsAt: string | null;
    timeZone: string | null;
    place: Place | null;
    entryFeeCents: number | null;
    currency: string;
    maxPlayers: number | null;
    description: string | null;
    prizes: string | null;
    shop: { id: string; name: string; slug: string; status: string } | null;
  };
  players: PlayerView[];
  rounds: RoundView[];
  standings: Standing[];
  finalStandings: FinalStanding[] | null;
  organizers: { userId: string; name: string; role: "owner" | "co" }[];
  /** Organisateur seulement. */
  logs: MatchLogView[];
};

function parse(json: string) {
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

function matchView(t: FullTournament, match: MatchRow, now: Date, showDeclarations: boolean): MatchView {
  const state = toMatchState(match);
  return {
    id: match.id,
    table: match.table,
    slot: match.bracketSlot,
    playerAId: match.playerAId,
    playerBId: match.playerBId,
    status: state.status,
    kind: state.kind,
    gamesA: match.gamesA,
    gamesB: match.gamesB,
    declA: showDeclarations ? state.declA : null,
    declB: showDeclarations ? state.declB : null,
    declaredAt: match.declaredAt?.toISOString() ?? null,
    confirmedOnSite: match.confirmedOnSite,
    extraSeconds: match.extraSeconds,
    version: match.version,
    overdue: isOverdue(state, now, t.declareTimeoutMinutes),
  };
}

export function buildView(t: FullTournament, viewer: Viewer, now = new Date()): TournamentView {
  const orgRole = organizerRole(t, viewer.userId);
  const mePlayer = findViewerPlayer(t, viewer);
  const role: ViewRole = orgRole ? "organizer" : mePlayer ? "player" : "public";
  const isOrganizer = role === "organizer";

  const players: PlayerView[] = t.players
    .filter(
      (player) => isOrganizer || (player.status !== "pending" && player.status !== "waitlist") || player.id === mePlayer?.id,
    )
    .map((player) => ({
      id: player.id,
      name: player.name,
      status: player.status as PlayerView["status"],
      waitlistPosition: player.status === "waitlist" ? waitlistPosition(t.players, player.id) : null,
      hasApp: hasApp(player),
      isAccount: player.userId !== null,
      joinedRound: player.joinedRound,
      dqReason: player.dqReason,
      cutDeclined: player.cutDeclined,
    }));

  const rounds: RoundView[] = t.rounds
    .filter((round) => isOrganizer || round.status !== "draft")
    .map((round) => ({
      id: round.id,
      number: round.number,
      phase: round.phase as RoundView["phase"],
      status: round.status as RoundView["status"],
      startedAt: round.startedAt?.toISOString() ?? null,
      durationSeconds: round.durationSeconds,
      pausedAt: round.pausedAt?.toISOString() ?? null,
      pausedSeconds: round.pausedSeconds,
      addedSeconds: round.addedSeconds,
      matches: round.matches.map((match) =>
        matchView(
          t,
          match,
          now,
          isOrganizer || (mePlayer !== null && (match.playerAId === mePlayer.id || match.playerBId === mePlayer.id)),
        ),
      ),
    }));

  const standings = tournamentStandings(t);
  const cut = readCut(t);
  const finalStandings =
    t.status === "termine" && cut
      ? computeFinalStandings(standings, standingsMatches(t), t.championId)
      : null;

  return {
    revision: t.revision,
    serverNow: now.toISOString(),
    role,
    organizerRole: orgRole,
    me: players.find((player) => player.id === mePlayer?.id) ?? null,
    tournament: {
      id: t.id,
      code: role === "public" ? null : t.code,
      name: t.name,
      format: t.format as TournamentView["tournament"]["format"],
      matchType: t.matchType as TournamentView["tournament"]["matchType"],
      status: t.status as TournamentStatus,
      roundMinutes: t.roundMinutes,
      topCutExtraMinutes: t.topCutExtraMinutes,
      topCutSetting: t.topCutSetting,
      swissRounds: t.swissRounds,
      registrationOpen: t.registrationOpen,
      requireApproval: t.requireApproval,
      oneDeviceMode: t.oneDeviceMode as TournamentView["tournament"]["oneDeviceMode"],
      declareTimeoutMinutes: t.declareTimeoutMinutes,
      lateEntryPolicy: t.lateEntryPolicy as TournamentView["tournament"]["lateEntryPolicy"],
      championId: t.championId,
      cutSeeds: cut?.seeds ?? [],
      cutDraws: readCutDraws(t),
      visibility: t.visibility === "public" ? "public" : "private",
      startsAt: t.startsAt?.toISOString() ?? null,
      timeZone: t.timeZone,
      place: placeFromRow(t),
      entryFeeCents: t.entryFeeCents,
      currency: t.currency,
      maxPlayers: t.maxPlayers,
      description: t.description,
      prizes: t.prizes,
      shop: t.shop ? { id: t.shop.id, name: t.shop.name, slug: t.shop.slug, status: t.shop.status } : null,
    },
    players,
    rounds,
    standings,
    finalStandings,
    organizers: isOrganizer
      ? t.organizers.map((organizer) => ({
          userId: organizer.userId,
          name: organizer.user.displayName,
          role: organizer.role as "owner" | "co",
        }))
      : [],
    logs: isOrganizer
      ? t.rounds.flatMap((round) =>
          round.matches.flatMap((match) =>
            match.logs.map((log) => ({
              id: log.id,
              matchId: log.matchId,
              action: log.action,
              actorUserId: log.actorUserId,
              actorPlayerId: log.actorPlayerId,
              before: parse(log.beforeJson),
              after: parse(log.afterJson),
              at: log.createdAt.toISOString(),
            })),
          ),
        )
      : [],
  };
}
