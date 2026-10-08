import { prisma } from "./prisma";
import type { CollectionItemDTO } from "./types";

type SaveInput = {
  printingId: string;
  conditionCode: string;
  quantity: number;
  mode: "add" | "set";
  notes?: string | null;
  purchasePrice?: string | null;
  purchaseCurrency?: string | null;
};

type PatchInput = {
  conditionCode?: string;
  quantity?: number;
  notes?: string | null;
  purchasePrice?: string | null;
  purchaseCurrency?: string | null;
};

export type MutationResult = {
  item: CollectionItemDTO | null;
  deletedId: string | null;
};

const include = { condition: true } as const;

/** Exemplaires maximum par ligne (carte × état), quel que soit le nombre d'ajouts. */
export const MAX_LINE_QUANTITY = 999;

const capped = (quantity: number) => Math.min(quantity, MAX_LINE_QUANTITY);

function toDTO(item: {
  id: string;
  printingId: string;
  quantity: number;
  notes: string | null;
  purchasePrice: { toString(): string } | null;
  purchaseCurrency: string | null;
  addedAt: Date;
  condition: { code: string; name: string };
}): CollectionItemDTO {
  return {
    id: item.id,
    printingId: item.printingId,
    conditionCode: item.condition.code,
    conditionName: item.condition.name,
    quantity: item.quantity,
    notes: item.notes,
    purchasePrice: item.purchasePrice ? item.purchasePrice.toString() : null,
    purchaseCurrency: item.purchaseCurrency,
    addedAt: item.addedAt.toISOString(),
  };
}

export async function saveCollectionLine(userId: string, input: SaveInput): Promise<MutationResult> {
  const printing = await prisma.printing.findFirst({
    where: { id: input.printingId, isActive: true },
  });
  const condition = await prisma.condition.findUnique({ where: { code: input.conditionCode } });
  if (!printing || !condition) {
    throw new Error("Carte ou état introuvable.");
  }
  const where = {
    userId_printingId_conditionId: {
      userId,
      printingId: printing.id,
      conditionId: condition.id,
    },
  };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.collectionItem.findUnique({ where, include });
    // Ajouter 0 exemplaire ne change rien (seul « set 0 » retire la ligne).
    if (input.mode === "add" && input.quantity <= 0) {
      return { item: existing ? toDTO(existing) : null, deletedId: null };
    }
    if (input.quantity <= 0) {
      if (!existing) return { item: null, deletedId: null };
      await tx.collectionItem.delete({ where: { id: existing.id } });
      return { item: null, deletedId: existing.id };
    }

    if (input.mode === "add" && existing) {
      const notes = input.notes === undefined ? undefined : input.notes;
      const purchasePrice = input.purchasePrice === undefined ? undefined : input.purchasePrice;
      const purchaseCurrency = input.purchaseCurrency === undefined ? undefined : input.purchaseCurrency;
      const saved = await tx.collectionItem.update({
        where: { id: existing.id },
        data: {
          quantity: capped(existing.quantity + input.quantity),
          ...(notes !== undefined ? { notes } : {}),
          ...(purchasePrice !== undefined ? { purchasePrice } : {}),
          ...(purchaseCurrency !== undefined ? { purchaseCurrency } : {}),
        },
        include,
      });
      return { item: toDTO(saved), deletedId: null };
    }

    const quantity = capped(input.quantity);
    const data = {
      quantity,
      notes: input.notes === undefined ? existing?.notes ?? null : input.notes,
      purchasePrice:
        input.purchasePrice === undefined ? existing?.purchasePrice ?? null : input.purchasePrice,
      purchaseCurrency:
        input.purchaseCurrency === undefined
          ? existing?.purchaseCurrency ?? null
          : input.purchaseCurrency,
    };
    const saved = existing
      ? await tx.collectionItem.update({ where: { id: existing.id }, data, include })
      : await tx.collectionItem.create({
          data: {
            userId,
            printingId: printing.id,
            conditionId: condition.id,
            ...data,
          },
          include,
        });
    return { item: toDTO(saved), deletedId: null };
  });
}

export async function saveCollectionBatch(
  userId: string,
  input: { conditionCode: string; lines: { printingId: string; quantity: number }[] },
) {
  if (input.lines.length > 400) throw new Error("Trop de cartes d'un coup.");
  const lines = input.lines.filter((line) => line.quantity > 0 && line.quantity <= 999);
  if (lines.length === 0) return [];
  if (lines.length > 400) throw new Error("Trop de cartes d'un coup.");
  const condition = await prisma.condition.findUnique({ where: { code: input.conditionCode } });
  if (!condition) throw new Error("État introuvable.");
  const printingIds = [...new Set(lines.map((line) => line.printingId))];
  const printings = await prisma.printing.findMany({
    where: { id: { in: printingIds }, isActive: true },
    select: { id: true },
  });
  const valid = new Set(printings.map((printing) => printing.id));
  const accepted = lines.filter((line) => valid.has(line.printingId));
  if (accepted.length === 0) throw new Error("Aucune carte valide.");

  return prisma.$transaction(async (tx) => {
    const saved = [];
    for (const line of accepted) {
      const where = {
        userId_printingId_conditionId: {
          userId,
          printingId: line.printingId,
          conditionId: condition.id,
        },
      };
      const existing = await tx.collectionItem.findUnique({ where });
      const row = existing
        ? await tx.collectionItem.update({
            where: { id: existing.id },
            data: { quantity: capped(existing.quantity + line.quantity) },
            include,
          })
        : await tx.collectionItem.create({
            data: {
              userId,
              printingId: line.printingId,
              conditionId: condition.id,
              quantity: line.quantity,
            },
            include,
          });
      saved.push(toDTO(row));
    }
    return saved;
  });
}

export async function patchCollectionLine(
  userId: string,
  id: string,
  input: PatchInput,
): Promise<MutationResult> {
  return prisma.$transaction(async (tx) => {
    const current = await tx.collectionItem.findFirst({
      where: { id, userId },
      include,
    });
    if (!current) throw new Error("Ligne introuvable.");
    if (input.quantity != null && input.quantity <= 0) {
      await tx.collectionItem.delete({ where: { id: current.id } });
      return { item: null, deletedId: current.id };
    }
    const conditionCode = input.conditionCode ?? current.condition.code;
    const condition = await tx.condition.findUnique({ where: { code: conditionCode } });
    if (!condition) throw new Error("État introuvable.");
    const moved = condition.id !== current.conditionId;
    if (moved) {
      const target = await tx.collectionItem.findUnique({
        where: {
          userId_printingId_conditionId: {
            userId,
            printingId: current.printingId,
            conditionId: condition.id,
          },
        },
      });
      if (target) {
        const quantity = capped((input.quantity ?? current.quantity) + target.quantity);
        const saved = await tx.collectionItem.update({
          where: { id: target.id },
          data: {
            quantity,
            notes: input.notes === undefined ? target.notes : input.notes,
            purchasePrice:
              input.purchasePrice === undefined ? target.purchasePrice : input.purchasePrice,
            purchaseCurrency:
              input.purchaseCurrency === undefined ? target.purchaseCurrency : input.purchaseCurrency,
          },
          include,
        });
        await tx.collectionItem.delete({ where: { id: current.id } });
        return { item: toDTO(saved), deletedId: current.id };
      }
    }
    const saved = await tx.collectionItem.update({
      where: { id: current.id },
      data: {
        conditionId: condition.id,
        quantity: input.quantity ?? current.quantity,
        notes: input.notes === undefined ? current.notes : input.notes,
        purchasePrice: input.purchasePrice === undefined ? current.purchasePrice : input.purchasePrice,
        purchaseCurrency:
          input.purchaseCurrency === undefined ? current.purchaseCurrency : input.purchaseCurrency,
      },
      include,
    });
    return { item: toDTO(saved), deletedId: null };
  });
}

export async function deleteCollectionLine(userId: string, id: string): Promise<MutationResult> {
  const current = await prisma.collectionItem.findFirst({ where: { id, userId } });
  if (!current) return { item: null, deletedId: null };
  await prisma.collectionItem.delete({ where: { id: current.id } });
  return { item: null, deletedId: current.id };
}
