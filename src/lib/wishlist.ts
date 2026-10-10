// Liste de souhaits et alertes de prix. Le prix cible (EUR) est comparé au prix tendance
// Cardmarket ; l'évaluation tourne après chaque import des prix (cron quotidien).
import type { PrismaClient } from "@prisma/client";
import { wishlistTargetReached } from "./logic";
import { prisma } from "./prisma";
import type { WishlistItemDTO } from "./types";

/** Nombre maximum de cartes dans la liste de souhaits d'un compte. */
export const MAX_WISHLIST_ITEMS = 1000;

type SaveInput = { printingId: string; targetPrice?: string | null; notes?: string | null };
type PatchInput = { targetPrice?: string | null; notes?: string | null };

type Row = {
  id: string;
  printingId: string;
  targetPrice: { toString(): string } | null;
  notes: string | null;
  alertAt: Date | null;
  alertPrice: { toString(): string } | null;
  alertSeen: boolean;
  createdAt: Date;
};

function toDTO(row: Row): WishlistItemDTO {
  return {
    id: row.id,
    printingId: row.printingId,
    targetPrice: row.targetPrice ? Number(row.targetPrice.toString()).toFixed(2) : null,
    notes: row.notes,
    alertAt: row.alertAt?.toISOString() ?? null,
    alertPrice: row.alertPrice ? Number(row.alertPrice.toString()).toFixed(2) : null,
    alertSeen: row.alertSeen,
    createdAt: row.createdAt.toISOString(),
  };
}

const amount = (value: { toString(): string } | null | undefined) => (value == null ? null : Number(value.toString()));

/** Prix tendance Cardmarket actuel d'un tirage (null s'il n'est pas coté). */
async function currentTrend(client: PrismaClient, printingId: string) {
  const price = await client.price.findFirst({
    where: { printingId, kind: "trend", source: { code: "cardmarket" } },
    select: { amount: true },
  });
  return amount(price?.amount);
}

/**
 * État d'alerte après un changement de cible par l'utilisateur : une cible déjà atteinte
 * est marquée « vue » (il a le prix sous les yeux), une cible non atteinte efface l'alerte.
 */
function alertAfterEdit(target: number | null, price: number | null, previous: { alertAt: Date | null }) {
  if (!wishlistTargetReached(target, price)) return { alertAt: null, alertPrice: null, alertSeen: true };
  return { alertAt: previous.alertAt ?? new Date(), alertPrice: price!.toFixed(2), alertSeen: true };
}

export async function loadWishlist(userId: string) {
  const rows = await prisma.wishlistItem.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return rows.map(toDTO);
}

/** Ajoute une carte (ou met à jour sa cible si elle est déjà dans la liste). */
export async function saveWishlistItem(userId: string, input: SaveInput) {
  const printing = await prisma.printing.findFirst({ where: { id: input.printingId, isActive: true }, select: { id: true } });
  if (!printing) throw new Error("Carte introuvable.");
  const where = { userId_printingId: { userId, printingId: printing.id } };
  const existing = await prisma.wishlistItem.findUnique({ where });
  if (!existing && (await prisma.wishlistItem.count({ where: { userId } })) >= MAX_WISHLIST_ITEMS) {
    throw new Error(`Liste de souhaits pleine (${MAX_WISHLIST_ITEMS} cartes maximum).`);
  }
  const targetPrice = input.targetPrice === undefined ? (existing?.targetPrice?.toString() ?? null) : input.targetPrice;
  const notes = input.notes === undefined ? (existing?.notes ?? null) : input.notes;
  const alert = alertAfterEdit(amount(targetPrice), await currentTrend(prisma, printing.id), existing ?? { alertAt: null });
  const row = await prisma.wishlistItem.upsert({
    where,
    create: { userId, printingId: printing.id, targetPrice, notes, ...alert },
    update: { targetPrice, notes, ...alert },
  });
  return toDTO(row);
}

export async function patchWishlistItem(userId: string, id: string, input: PatchInput) {
  const existing = await prisma.wishlistItem.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Carte absente de la liste de souhaits.");
  const data: Record<string, unknown> = {};
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.targetPrice !== undefined) {
    data.targetPrice = input.targetPrice;
    Object.assign(data, alertAfterEdit(amount(input.targetPrice), await currentTrend(prisma, existing.printingId), existing));
  }
  const row = await prisma.wishlistItem.update({ where: { id }, data });
  return toDTO(row);
}

export async function deleteWishlistItem(userId: string, id: string) {
  const result = await prisma.wishlistItem.deleteMany({ where: { id, userId } });
  return { deletedId: result.count > 0 ? id : null };
}

/** Marque toutes les alertes du compte comme vues. */
export async function acknowledgeWishlistAlerts(userId: string) {
  await prisma.wishlistItem.updateMany({ where: { userId, alertSeen: false }, data: { alertSeen: true } });
}

export type WishlistAlertReport = { checked: number; triggered: number; cleared: number };

/**
 * Compare chaque cible au prix tendance actuel (appelé après l'import des prix) :
 * - prix passé sous la cible → nouvelle alerte non vue ;
 * - prix repassé au-dessus → alerte effacée (une prochaine baisse alertera de nouveau).
 */
export async function evaluateWishlistAlerts(client: PrismaClient): Promise<WishlistAlertReport> {
  const items = await client.wishlistItem.findMany({
    where: { targetPrice: { not: null } },
    select: {
      id: true,
      targetPrice: true,
      alertAt: true,
      alertPrice: true,
      printing: {
        select: {
          prices: { where: { kind: "trend", source: { code: "cardmarket" } }, select: { amount: true }, take: 1 },
        },
      },
    },
  });
  const now = new Date();
  const updates: ReturnType<typeof client.wishlistItem.update>[] = [];
  let triggered = 0;
  let cleared = 0;
  for (const item of items) {
    const price = amount(item.printing.prices[0]?.amount);
    const reached = wishlistTargetReached(amount(item.targetPrice), price);
    if (reached && !item.alertAt) {
      triggered += 1;
      updates.push(
        client.wishlistItem.update({
          where: { id: item.id },
          data: { alertAt: now, alertPrice: price!.toFixed(2), alertSeen: false },
        }),
      );
    } else if (reached) {
      // Alerte déjà signalée : on suit le prix sans la renvoyer.
      if (Math.round(price! * 100) !== Math.round((amount(item.alertPrice) ?? 0) * 100)) {
        updates.push(client.wishlistItem.update({ where: { id: item.id }, data: { alertPrice: price!.toFixed(2) } }));
      }
    } else if (item.alertAt) {
      cleared += 1;
      updates.push(
        client.wishlistItem.update({
          where: { id: item.id },
          data: { alertAt: null, alertPrice: null, alertSeen: true },
        }),
      );
    }
  }
  for (let index = 0; index < updates.length; index += 200) {
    await client.$transaction(updates.slice(index, index + 200));
  }
  return { checked: items.length, triggered, cleared };
}
