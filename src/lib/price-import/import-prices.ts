// Import du guide de prix Cardmarket (prix tendance + historique quotidien + produits scellés,
// et prix bas / moyens du guide, sans historique).
// Utilisé par le script local (scripts/import-prices.ts) et par le cron Vercel
// (src/app/api/cron/import-prices/route.ts).
import type { PrismaClient } from "@prisma/client";
import {
  GUIDE_DETAIL_KINDS,
  parseGuideDetailsFile,
  parsePriceFile,
  parsePriceGuideDate,
  parseProductFile,
  type GuideDetails,
} from "../cardmarket/parse";
import { matchCardmarketPrices } from "../cardmarket/match";
import { parseSealedProductFile, type SealedProduct } from "../cardmarket-sealed";
import { upsertPromoProducts } from "../cardmarket-promos";
import { shiftUtcDay, utcDay, utcDayKey } from "../price-history";
import { reportError } from "../monitoring";
import type { PushReport } from "../push";
import { evaluateWishlistAlerts } from "../wishlist";
import { readText, resolveFiles } from "./files";
import { sealedPriceAssignments, upsertSealedProducts } from "./sealed";
import type { Ctx, ImportPricesOptions, ImportPricesResult } from "./types";

export async function importPrices(prisma: PrismaClient, options: ImportPricesOptions): Promise<ImportPricesResult> {
  const ctx: Ctx = { prisma, cacheDir: options.cacheDir, log: options.log ?? console.info };
  const files = options.files ?? (await resolveFiles(ctx, options.offline ?? false));
  let products;
  let trends;
  let guideDetails: Map<number, GuideDetails>;
  let sealedProducts: SealedProduct[] = [];
  let guideDate: Date | null;
  try {
    const [productText, priceText] = await Promise.all([readText(files.products), readText(files.prices)]);
    products = parseProductFile(productText);
    trends = parsePriceFile(priceText);
    guideDetails = parseGuideDetailsFile(priceText);
    guideDate = parsePriceGuideDate(priceText);
    if (files.nonsingles) {
      sealedProducts = parseSealedProductFile(await readText(files.nonsingles));
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "fichier illisible";
    throw new Error(
      `Lecture impossible (${detail}). Il faut le JSON du catalogue singles, du guide de prix, et idéalement des produits scellés/lots Cardmarket.`,
    );
  }

  const skipped = await assertNewGuide(ctx, guideDate, options.force ?? false);
  if (skipped) return { status: "skipped", message: skipped };

  const sealedUpsert =
    sealedProducts.length > 0 ? await upsertSealedProducts(ctx, sealedProducts) : { products: 0 };
  const promoUpsert = await upsertPromoProducts(prisma, products);
  const sealedAssignments = await sealedPriceAssignments(ctx, trends);

  const [sets, printings] = await Promise.all([
    prisma.set.findMany({ select: { code: true, name: true } }),
    prisma.printing.findMany({
      where: { isActive: true, NOT: { externalId: { startsWith: "cardmarket:" } } },
      select: {
        id: true,
        collectorNumber: true,
        set: { select: { code: true } },
        card: { select: { canonicalName: true } },
      },
    }),
  ]);
  const report = matchCardmarketPrices(
    products,
    trends,
    sets,
    printings.map((printing) => ({
      id: printing.id,
      setCode: printing.set.code,
      collectorNumber: printing.collectorNumber,
      name: printing.card.canonicalName,
    })),
  );
  const assignments = [...report.assignments, ...sealedAssignments];
  if (assignments.length === 0) {
    throw new Error(
      "Aucun prix tendance n'a pu être associé. Vérifiez que les fichiers sont bien ceux de Cyberpunk.",
    );
  }

  const source = await prisma.priceSource.upsert({
    where: { code: "cardmarket" },
    update: { name: "Cardmarket" },
    create: { code: "cardmarket", name: "Cardmarket" },
  });
  const today = utcDay();
  const yesterday = shiftUtcDay(today, -1);
  const [existing, todaySnapshots] = await Promise.all([
    prisma.price.findMany({
      where: { sourceId: source.id, kind: "trend" },
      select: { printingId: true, amount: true, previousAmount: true },
    }),
    prisma.priceSnapshot.findMany({
      where: { sourceId: source.id, kind: "trend", day: today },
      select: { printingId: true, amount: true },
    }),
  ]);
  const previousByPrinting = new Map(
    existing.map((price) => [
      price.printingId,
      { amount: price.amount, previousAmount: price.previousAmount },
    ]),
  );
  const todayAmountByPrinting = new Map(
    todaySnapshots.map((row) => [row.printingId, Number(row.amount.toString())]),
  );

  const archivedBaselines: { printingId: string; amount: number }[] = [];
  for (const assignment of assignments) {
    const next = Number(assignment.amount);
    const snapAmount = todayAmountByPrinting.get(assignment.printingId);
    if (snapAmount != null && moneyChanged(snapAmount, next)) {
      archivedBaselines.push({ printingId: assignment.printingId, amount: snapAmount });
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.price.deleteMany({ where: { sourceId: source.id, kind: "trend" } });
    for (let index = 0; index < assignments.length; index += 200) {
      const chunk = assignments.slice(index, index + 200);
      await tx.price.createMany({
        data: chunk.map((assignment) => {
          const next = Number(assignment.amount);
          const prior = previousByPrinting.get(assignment.printingId);
          const snapAmount = todayAmountByPrinting.get(assignment.printingId);
          const oldAmount =
            snapAmount != null && Number.isFinite(snapAmount)
              ? snapAmount
              : prior
                ? Number(prior.amount.toString())
                : null;
          let previousAmount: string | null = null;
          if (oldAmount != null && Number.isFinite(oldAmount) && moneyChanged(oldAmount, next)) {
            previousAmount = oldAmount.toFixed(2);
          } else if (prior?.previousAmount != null) {
            previousAmount = prior.previousAmount.toString();
          }
          return {
            printingId: assignment.printingId,
            sourceId: source.id,
            kind: "trend",
            amount: assignment.amount,
            previousAmount,
            currency: "EUR",
          };
        }),
      });
    }
  });

  // Prix bas / moyens du guide, pour les impressions cotées : remplacés à chaque import, sans historique.
  const detailRows = assignments.flatMap((assignment) => {
    const details = guideDetails.get(assignment.productId);
    if (!details) return [];
    return GUIDE_DETAIL_KINDS.flatMap((kind) => {
      const value = details[kind];
      return value == null
        ? []
        : [{ printingId: assignment.printingId, sourceId: source.id, kind, amount: value.toFixed(2), currency: "EUR" }];
    });
  });
  const detailChunks = [];
  for (let index = 0; index < detailRows.length; index += 200) {
    detailChunks.push(prisma.price.createMany({ data: detailRows.slice(index, index + 200) }));
  }
  await prisma.$transaction([
    prisma.price.deleteMany({ where: { sourceId: source.id, kind: { in: [...GUIDE_DETAIL_KINDS] } } }),
    ...detailChunks,
  ]);

  const pricedPrintingIds = new Set(assignments.map((assignment) => assignment.printingId));
  const orphanedPrintingIds = existing
    .map((price) => price.printingId)
    .filter((printingId) => !pricedPrintingIds.has(printingId));
  if (orphanedPrintingIds.length > 0) {
    await prisma.priceSnapshot.deleteMany({
      where: {
        sourceId: source.id,
        kind: "trend",
        printingId: { in: orphanedPrintingIds },
      },
    });
    // L'historique passé a changé : les courbes de portefeuille figées sont à recalculer.
    await prisma.portfolioHistoryCache.deleteMany({});
  }

  let snapshotsWritten = 0;
  let baselinesWritten = 0;
  const baselineCandidates: { printingId: string; amount: number }[] = [...archivedBaselines];
  for (const assignment of assignments) {
    const prior = previousByPrinting.get(assignment.printingId);
    if (!prior) continue;
    const oldAmount = Number(prior.amount.toString());
    const next = Number(assignment.amount);
    if (todayAmountByPrinting.has(assignment.printingId)) continue;
    // Archive la veille uniquement si le prix change : c'est alors l'ancien prix qui valait hier.
    // Un prix inchangé n'a rien à archiver (son `previousAmount` peut dater de plusieurs jours :
    // l'écrire la veille inventerait un creux ou un pic après un jour sans import).
    if (!Number.isFinite(oldAmount) || oldAmount <= 0 || !moneyChanged(oldAmount, next)) continue;
    baselineCandidates.push({ printingId: assignment.printingId, amount: oldAmount });
  }
  const existingBaselines = baselineCandidates.length
    ? await prisma.priceSnapshot.findMany({
        where: {
          sourceId: source.id,
          kind: "trend",
          day: yesterday,
          printingId: { in: baselineCandidates.map((row) => row.printingId) },
        },
        select: { printingId: true },
      })
    : [];
  const hasBaseline = new Set(existingBaselines.map((row) => row.printingId));

  for (let index = 0; index < assignments.length; index += 200) {
    const chunk = assignments.slice(index, index + 200);
    const result = await prisma.$transaction(
      chunk.map((assignment) =>
        prisma.priceSnapshot.upsert({
          where: {
            printingId_sourceId_kind_day: {
              printingId: assignment.printingId,
              sourceId: source.id,
              kind: "trend",
              day: today,
            },
          },
          update: { amount: assignment.amount, currency: "EUR" },
          create: {
            printingId: assignment.printingId,
            sourceId: source.id,
            kind: "trend",
            amount: assignment.amount,
            currency: "EUR",
            day: today,
          },
        }),
      ),
    );
    snapshotsWritten += result.length;
  }

  const baselinesToCreate = baselineCandidates.filter((row) => !hasBaseline.has(row.printingId));
  for (let index = 0; index < baselinesToCreate.length; index += 200) {
    const chunk = baselinesToCreate.slice(index, index + 200);
    const created = await prisma.priceSnapshot.createMany({
      data: chunk.map((row) => ({
        printingId: row.printingId,
        sourceId: source.id,
        kind: "trend",
        amount: row.amount,
        currency: "EUR",
        day: yesterday,
      })),
    });
    baselinesWritten += created.count;
  }

  await prisma.priceSource.update({ where: { id: source.id }, data: { guideCreatedAt: guideDate } });

  // Nouveaux prix : signale les cartes souhaitées passées sous leur prix cible.
  const { triggeredItems, ...wishlistAlerts } = await evaluateWishlistAlerts(prisma);
  // Notifications push des nouvelles alertes : un échec ne fait jamais échouer l'import.
  let pushNotifications: PushReport | { error: true } | null = null;
  try {
    const { notifyPriceAlerts } = await import("../push");
    pushNotifications = await notifyPriceAlerts(prisma, triggeredItems, { log: ctx.log });
    if (pushNotifications.failed) await reportError("price-alerts-push", `${pushNotifications.failed} envoi(s) en échec`);
  } catch (error) {
    pushNotifications = { error: true };
    await reportError("price-alerts-push", error);
  }

  return {
    status: "imported",
    report: {
      products: files.products,
      prices: files.prices,
      guideCreatedAt: guideDate?.toISOString() ?? null,
      nonsingles: files.nonsingles,
      productsRead: report.products,
      withTrend: report.pricedProducts,
      matchedProducts: report.matchedProducts,
      sealedProducts: sealedUpsert.products,
      sealedPriced: sealedAssignments.length,
      promosAdded: promoUpsert.added,
      promosRetired: promoUpsert.retired,
      printingsPriced: assignments.length,
      guideDetailsWritten: detailRows.length,
      ambiguous: report.ambiguousProducts,
      unknownExpansion: report.unknownExpansionProducts,
      unknownExpansions: report.unknownExpansions,
      unmatchedSamples: report.unmatchedSamples,
      snapshotDay: utcDayKey(today),
      snapshotsWritten,
      baselinesWritten,
      wishlistAlerts,
      pushNotifications,
      expansions: report.expansions.map((entry) => ({
        expansion: entry.key,
        set: entry.setCode,
        products: entry.products,
      })),
    },
  };
}

/** Renvoie un message si le guide est déjà importé (ou plus ancien), sinon null. */
async function assertNewGuide({ prisma }: Ctx, guideDate: Date | null, force: boolean) {
  if (force) return null;
  if (!guideDate) {
    throw new Error(
      "Le guide de prix n'a pas de date (createdAt). Import annulé ; relancez avec --force pour l'importer quand même.",
    );
  }
  const source = await prisma.priceSource.findUnique({
    where: { code: "cardmarket" },
    select: { guideCreatedAt: true },
  });
  const last = source?.guideCreatedAt;
  if (last && guideDate.getTime() <= last.getTime()) {
    const same = guideDate.getTime() === last.getTime();
    return [
      same
        ? `Ce guide de prix (${guideDate.toISOString()}) a déjà été importé.`
        : `Ce guide de prix (${guideDate.toISOString()}) est plus ancien que le dernier importé (${last.toISOString()}).`,
      "Rien n'a été modifié. Relancez avec --force pour l'importer quand même.",
    ].join("\n");
  }
  return null;
}

function moneyChanged(left: number, right: number) {
  return Math.round(left * 100) !== Math.round(right * 100);
}
