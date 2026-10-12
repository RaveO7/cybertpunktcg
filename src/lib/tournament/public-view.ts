// Fiche publique d'un tournoi public (cf. specs/tournaments/public-listing) : uniquement ce
// qu'un visiteur anonyme peut voir. Jamais le code, ni les ids de joueurs, ni les inscriptions
// en attente d'approbation, ni l'historique. Les pages publiques n'utilisent jamais buildView.

import { placeFromRow, type Place } from "@/lib/geo/location";
import { logoUrl } from "@/lib/shops/shops";
import { registrationPossible, seatsTaken, waitlist } from "./capacity";
import type { FullTournament } from "./repository";
import { readCut, standingsMatches, tournamentStandings, type TournamentStatus } from "./service";
import { computeFinalStandings } from "./standings";

/** Nom par défaut d'un compte : ce n'est pas un nom d'organisateur présentable. */
const DEFAULT_DISPLAY_NAME = "Ma collection";

export type PublicShopRef = { slug: string; name: string; verified: boolean; logoUrl: string | null };

export type PublicTournamentSummary = {
  id: string;
  name: string;
  status: TournamentStatus;
  startsAt: string | null;
  timeZone: string | null;
  venueName: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  format: "boutique" | "competitif";
  matchType: "bo1" | "bo3";
  entryFeeCents: number | null;
  currency: string;
  maxPlayers: number | null;
  /** Joueurs inscrits (actifs). */
  playerCount: number;
  waitlistCount: number;
  /** null = places illimitées. */
  seatsLeft: number | null;
  registrationOpen: boolean;
  shop: PublicShopRef | null;
  distanceKm: number | null;
};

export type PublicStandingRow = { rank: number; name: string; points: number; wins: number; losses: number; draws: number; champion: boolean };

export type PublicTournamentDetail = PublicTournamentSummary & {
  place: Place | null;
  description: string | null;
  prizes: string | null;
  swissRounds: number;
  roundMinutes: number;
  requireApproval: boolean;
  organizerName: string | null;
  championName: string | null;
  standings: PublicStandingRow[] | null;
};

type SummarySource = Pick<
  FullTournament,
  | "id"
  | "name"
  | "status"
  | "startsAt"
  | "timeZone"
  | "venueName"
  | "city"
  | "region"
  | "country"
  | "lat"
  | "lng"
  | "format"
  | "matchType"
  | "entryFeeCents"
  | "currency"
  | "maxPlayers"
  | "registrationOpen"
> & {
  players: { id: string; status: string; createdAt: Date }[];
  shop: { slug: string; name: string; status: string; logoUpdatedAt: Date | null } | null;
};

export function publicShopRef(shop: SummarySource["shop"]): PublicShopRef | null {
  // Boutique refusée : le tournoi reste listé, mais sans la boutique.
  if (!shop || shop.status === "rejected") return null;
  return { slug: shop.slug, name: shop.name, verified: shop.status === "verified", logoUrl: logoUrl(shop) };
}

export function buildPublicSummary(t: SummarySource, distanceKm: number | null = null): PublicTournamentSummary {
  const taken = seatsTaken(t.players);
  return {
    id: t.id,
    name: t.name,
    status: t.status as TournamentStatus,
    startsAt: t.startsAt?.toISOString() ?? null,
    timeZone: t.timeZone,
    venueName: t.venueName,
    city: t.city,
    region: t.region,
    country: t.country,
    lat: t.lat,
    lng: t.lng,
    format: t.format as PublicTournamentSummary["format"],
    matchType: t.matchType as PublicTournamentSummary["matchType"],
    entryFeeCents: t.entryFeeCents,
    currency: t.currency,
    maxPlayers: t.maxPlayers,
    playerCount: t.players.filter((player) => player.status === "active").length,
    waitlistCount: waitlist(t.players).length,
    seatsLeft: t.maxPlayers === null ? null : Math.max(0, t.maxPlayers - taken),
    registrationOpen: registrationPossible(t),
    shop: publicShopRef(t.shop),
    distanceKm,
  };
}

export function buildPublicView(t: FullTournament): PublicTournamentDetail {
  const owner = t.organizers.find((organizer) => organizer.role === "owner") ?? t.organizers[0];
  const ownerName = owner?.user.displayName;
  let standings: PublicStandingRow[] | null = null;
  let championName: string | null = null;
  if (t.status === "termine") {
    const swiss = tournamentStandings(t);
    const rows = readCut(t) ? computeFinalStandings(swiss, standingsMatches(t), t.championId) : null;
    standings = (rows ?? swiss).map((row, index) => ({
      rank: rows ? index + 1 : row.rank,
      name: row.name,
      points: row.points,
      wins: row.wins,
      losses: row.losses,
      draws: row.draws,
      champion: rows ? row.playerId === t.championId : index === 0,
    }));
    championName = standings.find((row) => row.champion)?.name ?? null;
  }
  return {
    ...buildPublicSummary(t),
    place: placeFromRow(t),
    description: t.description,
    prizes: t.prizes,
    swissRounds: t.swissRounds,
    roundMinutes: t.roundMinutes,
    requireApproval: t.requireApproval,
    organizerName: ownerName && ownerName !== DEFAULT_DISPLAY_NAME ? ownerName : null,
    championName,
    standings,
  };
}
