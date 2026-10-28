// Alertes de revente des cartes possédées. Le prix visé (EUR) est comparé au prix tendance Cardmarket ;
// l'évaluation tourne après chaque import des prix (cron quotidien), comme celle de la liste de souhaits
// (src/lib/wishlist.ts), et prévient quand le prix atteint la cible ou la dépasse.
import type { PrismaClient } from "@prisma/client";
import { fail } from "./app-error";
import { sellTargetReached } from "./logic";
import { prisma } from "./prisma";
import type { SellAlertDTO } from "./types";

type Row = {
  id: string;
  printingId: string;
  targetPrice: { toString(): string };
  alertAt: Date | null;
  alertPrice: { toString(): string } | null;
  alertSeen: boolean;
};

function toDTO(row: Row): SellAlertDTO {
  return {
    id: row.id,
    printingId: row.printingId,
    targetPrice: Number(row.targetPrice.toString()).toFixed(2),
    alertAt: row.alertAt?.toISOString() ?? null,
    alertPrice: row.alertPrice ? Number(row.alertPrice.toString()).toFixed(2) : null,
    alertSeen: row.alertSeen,
  };
}

const amount = (value: { toString(): string } | null | undefined) => (value == null ? null : Number(value.toString()));

/**
 * État d'alerte après un changement de cible : une cible déjà atteinte est marquée « vue »
 * (l'utilisateur a le prix sous les yeux), une cible non atteinte efface l'alerte.
 */
function alertAfterEdit(target: number, price: number | null, previous: { alertAt: Date | null } | null) {
  if (!sellTargetReached(target, price)) return { alertAt: null, alertPrice: null, alertSeen: true };
  return { alertAt: previous?.alertAt ?? new Date(), alertPrice: price!.toFixed(2), alertSeen: true };
}

export async function loadSellAlerts(userId: string) {
  const rows = await prisma.sellAlert.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
  return rows.map(toDTO);
}

/** Pose (ou remplace) le prix de revente visé d'une carte que le compte possède. */
export async function saveSellAlert(userId: string, input: { printingId: string; targetPrice: string }) {
  const owned = await prisma.collectionItem.findFirst({
    where: { userId, printingId: input.printingId, quantity: { gt: 0 } },
    select: { id: true },
  });
  if (!owned) fail("investment.alertNotOwned");
  const target = Number(input.targetPrice);
  if (!Number.isFinite(target) || target <= 0) fail("investment.invalidTargetPrice");
  const where = { userId_printingId: { userId, printingId: input.printingId } };
  const [existing, price] = await Promise.all([
    prisma.sellAlert.findUnique({ where }),
    prisma.price.findFirst({
      where: { printingId: input.printingId, kind: "trend", source: { code: "cardmarket" } },
      select: { amount: true },
    }),
  ]);
  const alert = alertAfterEdit(target, amount(price?.amount), existing);
  const row = await prisma.sellAlert.upsert({
    where,
    create: { userId, printingId: input.printingId, targetPrice: input.targetPrice, ...alert },
    update: { targetPrice: input.targetPrice, ...alert },
  });
  return toDTO(row);
}

export async function deleteSellAlert(userId: string, id: string) {
  const result = await prisma.sellAlert.deleteMany({ where: { id, userId } });
  return { deletedId: result.count > 0 ? id : null };
}

/** Marque toutes les alertes de revente du compte comme vues. */
export async function acknowledgeSellAlerts(userId: string) {
  await prisma.sellAlert.updateMany({ where: { userId, alertSeen: false }, data: { alertSeen: true } });
}

/** Alerte déclenchée par l'évaluation (prix passé au-dessus de la cible), à notifier. */
export type TriggeredSellAlert = { userId: string; printingId: string; price: number };

export type SellAlertReport = {
  checked: number;
  triggered: number;
  cleared: number;
  /** Nouvelles alertes seulement : ni celles qui suivent le prix, ni celles qui s'effacent. */
  triggeredItems: TriggeredSellAlert[];
};

/**
 * Compare chaque cible au prix tendance actuel (appelé après l'import des prix) :
 * - prix arrivé à la cible ou au-dessus → nouvelle alerte non vue ;
 * - prix repassé en dessous, ou carte plus possédée (toute vendue) → alerte effacée.
 */
export async function evaluateSellAlerts(client: PrismaClient): Promise<SellAlertReport> {
  const alerts = await client.sellAlert.findMany({
    select: {
      id: true,
      userId: true,
      printingId: true,
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
  if (alerts.length === 0) return { checked: 0, triggered: 0, cleared: 0, triggeredItems: [] };
  const owned = await client.collectionItem.groupBy({
    by: ["userId", "printingId"],
    where: {
      quantity: { gt: 0 },
      userId: { in: [...new Set(alerts.map((alert) => alert.userId))] },
      printingId: { in: [...new Set(alerts.map((alert) => alert.printingId))] },
    },
  });
  const ownedKeys = new Set(owned.map((row) => `${row.userId}|${row.printingId}`));
  const now = new Date();
  const updates: ReturnType<typeof client.sellAlert.update>[] = [];
  const triggeredItems: TriggeredSellAlert[] = [];
  let cleared = 0;
  for (const alert of alerts) {
    const price = amount(alert.printing.prices[0]?.amount);
    const reached = ownedKeys.has(`${alert.userId}|${alert.printingId}`) && sellTargetReached(amount(alert.targetPrice), price);
    if (reached && !alert.alertAt) {
      triggeredItems.push({ userId: alert.userId, printingId: alert.printingId, price: price! });
      updates.push(
        client.sellAlert.update({ where: { id: alert.id }, data: { alertAt: now, alertPrice: price!.toFixed(2), alertSeen: false } }),
      );
    } else if (reached) {
      // Alerte déjà signalée : on suit le prix sans la renvoyer.
      if (Math.round(price! * 100) !== Math.round((amount(alert.alertPrice) ?? 0) * 100)) {
        updates.push(client.sellAlert.update({ where: { id: alert.id }, data: { alertPrice: price!.toFixed(2) } }));
      }
    } else if (alert.alertAt) {
      cleared += 1;
      updates.push(
        client.sellAlert.update({ where: { id: alert.id }, data: { alertAt: null, alertPrice: null, alertSeen: true } }),
      );
    }
  }
  for (let index = 0; index < updates.length; index += 200) {
    await client.$transaction(updates.slice(index, index + 200));
  }
  return { checked: alerts.length, triggered: triggeredItems.length, cleared, triggeredItems };
}
