// Ventes d'exemplaires de la collection. Vendre retire les exemplaires de leur ligne et garde, dans la vente,
// leur prix de revient (prix, devise et date d'achat, notes) ; annuler la vente les remet dans la collection,
// dans la ligne identique si elle existe encore. Plus-value réalisée : src/lib/logic.ts (buildSaleLines) ;
// courbe : src/lib/investment-history.ts (les exemplaires vendus en sortent le jour de la vente).
import { fail } from "./app-error";
import { capped, toDTO, type MutationResult } from "./collection-mutate";
import { lineDate, lineKey, lineNotes, linePrice, purchaseDay } from "./collection-line";
import { prisma } from "./prisma";
import type { SaleDTO } from "./types";

type SellInput = {
  itemId: string;
  quantity: number;
  /** Prix de vente total des exemplaires et frais, dans `saleCurrency` (2 décimales). */
  salePrice: string;
  saleCurrency: string;
  fees: string;
  /** « AAAA-MM-JJ ». */
  soldAt: string;
};

type SalePatch = Partial<Pick<SellInput, "salePrice" | "saleCurrency" | "fees" | "soldAt">>;

const include = { condition: true } as const;

type SaleRow = {
  id: string;
  printingId: string;
  quantity: number;
  purchasePrice: { toString(): string } | null;
  purchaseCurrency: string | null;
  purchasedAt: Date | null;
  notes: string | null;
  addedAt: Date;
  salePrice: { toString(): string };
  saleCurrency: string;
  fees: { toString(): string };
  soldAt: Date;
  condition: { code: string };
};

function saleDTO(row: SaleRow): SaleDTO {
  return {
    id: row.id,
    printingId: row.printingId,
    conditionCode: row.condition.code,
    quantity: row.quantity,
    purchasePrice: linePrice(row.purchasePrice),
    purchaseCurrency: row.purchaseCurrency,
    purchasedAt: lineDate(row.purchasedAt),
    notes: row.notes,
    addedAt: row.addedAt.toISOString(),
    salePrice: linePrice(row.salePrice) ?? "0.00",
    saleCurrency: row.saleCurrency,
    fees: linePrice(row.fees) ?? "0.00",
    soldAt: lineDate(row.soldAt) ?? "",
  };
}

/** Une vente ne peut pas précéder l'achat de ses exemplaires. */
function checkSaleDay(soldAt: string, purchasedAt: Date | null) {
  const bought = lineDate(purchasedAt);
  if (bought != null && soldAt < bought) fail("investment.saleBeforePurchase");
}

export async function loadSales(userId: string) {
  const rows = await prisma.collectionSale.findMany({
    where: { userId },
    include,
    orderBy: [{ soldAt: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(saleDTO);
}

/** Vend `quantity` exemplaires d'une ligne : la vente est créée et la ligne diminuée (supprimée si tout est vendu). */
export async function sellCollectionLine(userId: string, input: SellInput): Promise<MutationResult & { sale: SaleDTO }> {
  return prisma.$transaction(async (tx) => {
    const line = await tx.collectionItem.findFirst({ where: { id: input.itemId, userId }, include });
    if (!line) fail("collection.lineNotFound", 404);
    if (input.quantity < 1 || input.quantity > line.quantity) {
      fail("investment.invalidSaleQuantity", 400, undefined, { max: line.quantity });
    }
    checkSaleDay(input.soldAt, line.purchasedAt);
    const sale = await tx.collectionSale.create({
      data: {
        userId,
        printingId: line.printingId,
        conditionId: line.conditionId,
        quantity: input.quantity,
        purchasePrice: line.purchasePrice,
        purchaseCurrency: line.purchasePrice == null ? null : line.purchaseCurrency || "EUR",
        purchasedAt: line.purchasedAt,
        notes: line.notes,
        addedAt: line.addedAt,
        salePrice: input.salePrice,
        saleCurrency: input.saleCurrency,
        fees: input.fees,
        soldAt: purchaseDay(input.soldAt) as Date,
      },
      include,
    });
    if (input.quantity === line.quantity) {
      await tx.collectionItem.delete({ where: { id: line.id } });
      return { sale: saleDTO(sale), item: null, deletedId: line.id };
    }
    const item = await tx.collectionItem.update({
      where: { id: line.id },
      data: { quantity: line.quantity - input.quantity },
      include,
    });
    return { sale: saleDTO(sale), item: toDTO(item), deletedId: null };
  });
}

/** Corrige le prix, la devise, les frais ou la date d'une vente. */
export async function patchSale(userId: string, id: string, input: SalePatch) {
  const current = await prisma.collectionSale.findFirst({ where: { id, userId } });
  if (!current) fail("investment.saleNotFound", 404);
  if (input.soldAt !== undefined) checkSaleDay(input.soldAt, current.purchasedAt);
  const row = await prisma.collectionSale.update({
    where: { id: current.id },
    data: {
      ...(input.salePrice !== undefined ? { salePrice: input.salePrice } : {}),
      ...(input.saleCurrency !== undefined ? { saleCurrency: input.saleCurrency } : {}),
      ...(input.fees !== undefined ? { fees: input.fees } : {}),
      ...(input.soldAt !== undefined ? { soldAt: purchaseDay(input.soldAt) as Date } : {}),
    },
    include,
  });
  return saleDTO(row);
}

/**
 * Annule une vente : ses exemplaires reviennent dans la ligne identique de la collection (même état, prix,
 * date d'achat et notes), sinon dans une nouvelle ligne qui garde la date d'ajout d'origine.
 */
export async function undoSale(userId: string, id: string): Promise<MutationResult & { deletedSaleId: string }> {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.collectionSale.findFirst({ where: { id, userId }, include });
    if (!sale) fail("investment.saleNotFound", 404);
    const conditionCode = sale.condition.code;
    const purchasePrice = linePrice(sale.purchasePrice);
    const fields = {
      notes: lineNotes(sale.notes),
      purchasePrice,
      purchaseCurrency: purchasePrice == null ? null : sale.purchaseCurrency || "EUR",
      purchasedAt: sale.purchasedAt,
    };
    const key = lineKey({ ...fields, conditionCode });
    const siblings = await tx.collectionItem.findMany({
      where: { userId, printingId: sale.printingId, conditionId: sale.conditionId },
      include,
      orderBy: { addedAt: "asc" },
    });
    const target = siblings.find((item) => lineKey({ ...item, conditionCode }) === key);
    const saved = target
      ? await tx.collectionItem.update({
          where: { id: target.id },
          data: { quantity: capped(target.quantity + sale.quantity) },
          include,
        })
      : await tx.collectionItem.create({
          data: {
            userId,
            printingId: sale.printingId,
            conditionId: sale.conditionId,
            quantity: capped(sale.quantity),
            ...fields,
            addedAt: sale.addedAt,
          },
          include,
        });
    await tx.collectionSale.delete({ where: { id: sale.id } });
    return { deletedSaleId: sale.id, item: toDTO(saved), deletedId: null };
  });
}
