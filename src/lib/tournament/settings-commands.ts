// Commandes organisateur : réglages, publication et boutique.

import type { OrganizerCommand } from "@/lib/api-schemas";
import { EMPTY_PLACE_COLUMNS, placeFromRow, toPlaceColumns } from "@/lib/geo/location";
import { OK, type CommandResult, type CommandWarning, type Ctx } from "./command-context";
import { fail } from "./errors";
import type { FullTournament, Tx } from "./repository";
import { deleteDraftRound, isStarted, pendingRound, startedSwissRounds } from "./service";

type Settings = Extract<OrganizerCommand, { type: "updateSettings" }>["settings"];

export async function updateSettings(tx: Tx, t: FullTournament, settings: Settings): Promise<CommandResult> {
  const started = startedSwissRounds(t) > 0;
  if (started) {
    for (const key of ["format", "matchType", "lateEntryPolicy"] as const) {
      if (settings[key] !== undefined && settings[key] !== t[key]) {
        fail("tournaments.settingLocked", 409);
      }
    }
  }
  if (settings.topCutSetting !== undefined && settings.topCutSetting !== t.topCutSetting && t.status !== "inscriptions" && t.status !== "suisse") {
    fail("tournaments.topCutStarted", 409);
  }
  const warnings: CommandWarning[] = [];
  if (settings.swissRounds !== undefined && settings.swissRounds !== t.swissRounds) {
    if (!started) fail("tournaments.roundsFixedAtStart", 409);
    if (t.status !== "suisse") fail("tournaments.swissFinished", 409);
    const startedCount = startedSwissRounds(t);
    const lastPlanned = t.rounds.find((round) => round.phase === "swiss" && round.number === t.swissRounds);
    if (lastPlanned && isStarted(lastPlanned)) fail("tournaments.lastRoundStarted", 409);
    if (settings.swissRounds < startedCount) fail("tournaments.roundsAlreadyStarted", 409, undefined, { count: startedCount });
    const draft = pendingRound(t);
    if (draft && draft.number > settings.swissRounds) await deleteDraftRound(tx, draft);
  }
  if (t.visibility === "public" && (settings.startsAt === null || settings.place === null)) {
    fail("tournaments.publicNeedsDateAndPlace", 409);
  }
  const { swissRounds, place, ...rest } = settings;
  await tx.tournament.update({
    where: { id: t.id },
    data: {
      ...rest,
      ...(swissRounds !== undefined ? { swissRounds } : {}),
      ...(place === undefined ? {} : place === null ? EMPTY_PLACE_COLUMNS : toPlaceColumns(place)),
    },
  });
  return { ok: true, warnings };
}

// --- Publication -----------------------------------------------------------------------------

/** Champs manquants pour publier (cf. specs/tournaments/public-listing). */
export function missingForPublication(t: Pick<FullTournament, "startsAt" | "city" | "country" | "lat" | "lng">, now: Date) {
  const missing: ("startsAt" | "place")[] = [];
  if (!t.startsAt || t.startsAt.getTime() <= now.getTime()) missing.push("startsAt");
  if (!t.city || !t.country || t.lat === null || t.lng === null) missing.push("place");
  return missing;
}

export async function setVisibility(tx: Tx, t: FullTournament, makePublic: boolean, ctx: Ctx): Promise<CommandResult> {
  if (!makePublic) {
    await tx.tournament.update({ where: { id: t.id }, data: { visibility: "private" } });
    return OK;
  }
  const missing = missingForPublication(t, ctx.now);
  if (missing.length) {
    fail("tournaments.publishMissing", 409, { missing }, { missing: missing.length === 1 ? missing[0] : "both" });
  }
  await tx.tournament.update({
    where: { id: t.id },
    data: { visibility: "public", publishedAt: t.publishedAt ?? ctx.now },
  });
  return OK;
}

export async function setShop(tx: Tx, t: FullTournament, shopId: string | null, ctx: Ctx): Promise<CommandResult> {
  if (shopId === null) {
    await tx.tournament.update({ where: { id: t.id }, data: { shopId: null } });
    return OK;
  }
  const shop = await tx.shop.findUnique({ where: { id: shopId } });
  if (!shop || shop.ownerId !== ctx.userId) fail("shops.notManager", 403);
  if (shop.status === "rejected") fail("tournaments.shopRejected", 409);
  // Sans lieu, le tournoi a lieu à la boutique (modifiable ensuite : tournoi hors les murs).
  const place = placeFromRow(t) ? {} : toPlaceColumns(placeFromRow(shop)!);
  await tx.tournament.update({ where: { id: t.id }, data: { shopId: shop.id, ...place } });
  return OK;
}
