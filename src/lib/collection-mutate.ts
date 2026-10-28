import { prisma } from "./prisma";
import type { CollectionItemDTO } from "./types";
import { fail } from "./app-error";
import { lineDate, lineKey, lineNotes, linePrice, matchLine, newLineFields, purchaseDay } from "./collection-line";

type SaveInput = {
  printingId: string;
  conditionCode: string;
  quantity: number;
  mode: "add" | "set";
  notes?: string | null;
  purchasePrice?: string | null;
  purchaseCurrency?: string | null;
  /** « AAAA-MM-JJ » ; null = date inconnue. */
  purchasedAt?: string | null;
};

type PatchInput = {
  conditionCode?: string;
  quantity?: number;
  notes?: string | null;
  purchasePrice?: string | null;
  purchaseCurrency?: string | null;
  /** « AAAA-MM-JJ » ; null = date inconnue. */
  purchasedAt?: string | null;
};

export type MutationResult = {
  item: CollectionItemDTO | null;
  deletedId: string | null;
};

const include = { condition: true } as const;

/** Exemplaires maximum par ligne (carte × état), quel que soit le nombre d'ajouts. */
export const MAX_LINE_QUANTITY = 999;

export const capped = (quantity: number) => Math.min(quantity, MAX_LINE_QUANTITY);

export function toDTO(item: {
  id: string;
  printingId: string;
  quantity: number;
  notes: string | null;
  purchasePrice: { toString(): string } | null;
  purchaseCurrency: string | null;
  purchasedAt: Date | null;
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
    purchasedAt: lineDate(item.purchasedAt),
    addedAt: item.addedAt.toISOString(),
  };
}

/**
 * Ajout (« add ») ou quantité fixée (« set ») pour une carte × état × prix × date × notes : la ligne identique
 * est mise à jour, sinon une nouvelle ligne est créée (voir matchLine pour un prix ou des notes absents).
 * Le prix et les notes d'une ligne existante ne se modifient que par patchCollectionLine.
 */
export async function saveCollectionLine(userId: string, input: SaveInput): Promise<MutationResult> {
  const printing = await prisma.printing.findFirst({
    where: { id: input.printingId, isActive: true },
  });
  const condition = await prisma.condition.findUnique({ where: { code: input.conditionCode } });
  if (!printing || !condition) {
    fail("collection.cardOrConditionNotFound");
  }
  const query = {
    conditionCode: condition.code,
    notes: input.notes,
    purchasePrice: input.purchasePrice,
    purchaseCurrency: input.purchaseCurrency,
    purchasedAt: input.purchasedAt,
  };

  return prisma.$transaction(async (tx) => {
    const candidates = await tx.collectionItem.findMany({
      where: { userId, printingId: printing.id, conditionId: condition.id },
      include,
      orderBy: { addedAt: "asc" },
    });
    const existing = matchLine(candidates.map((item) => ({ ...item, conditionCode: condition.code })), query) ?? null;
    // Ajouter 0 exemplaire ne change rien (seul « set 0 » retire la ligne).
    if (input.mode === "add" && input.quantity <= 0) {
      return { item: existing ? toDTO(existing) : null, deletedId: null };
    }
    if (input.quantity <= 0) {
      if (!existing) return { item: null, deletedId: null };
      await tx.collectionItem.delete({ where: { id: existing.id } });
      return { item: null, deletedId: existing.id };
    }

    const quantity = capped(input.mode === "add" && existing ? existing.quantity + input.quantity : input.quantity);
    const saved = existing
      ? await tx.collectionItem.update({ where: { id: existing.id }, data: { quantity }, include })
      : await tx.collectionItem.create({
          data: { userId, printingId: printing.id, conditionId: condition.id, quantity, ...newLineFields(query) },
          include,
        });
    return { item: toDTO(saved), deletedId: null };
  });
}

export async function saveCollectionBatch(
  userId: string,
  input: { conditionCode: string; lines: { printingId: string; quantity: number }[] },
) {
  if (input.lines.length > 400) fail("collection.tooManyCards");
  const lines = input.lines.filter((line) => line.quantity > 0 && line.quantity <= 999);
  if (lines.length === 0) return [];
  if (lines.length > 400) fail("collection.tooManyCards");
  const condition = await prisma.condition.findUnique({ where: { code: input.conditionCode } });
  if (!condition) fail("collection.conditionNotFound");
  const printingIds = [...new Set(lines.map((line) => line.printingId))];
  const printings = await prisma.printing.findMany({
    where: { id: { in: printingIds }, isActive: true },
    select: { id: true },
  });
  const valid = new Set(printings.map((printing) => printing.id));
  const accepted = lines.filter((line) => valid.has(line.printingId));
  if (accepted.length === 0) fail("collection.noValidCard");

  return prisma.$transaction(async (tx) => {
    const saved = [];
    for (const line of accepted) {
      // Ajout rapide, sans prix, date ni notes : ne rejoint que la ligne sans prix, date ni notes.
      const existing = await tx.collectionItem.findFirst({
        where: { userId, printingId: line.printingId, conditionId: condition.id, purchasePrice: null, purchasedAt: null, notes: null },
        orderBy: { addedAt: "asc" },
      });
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

type ImportInput = {
  mode: "add" | "set";
  lines: {
    printingId: string;
    conditionCode: string;
    quantity: number;
    notes?: string;
    purchasePrice?: string;
    purchaseCurrency?: string;
    purchasedAt?: string;
  }[];
};

/**
 * Import CSV : « add » ajoute aux quantités existantes, « set » remplace la quantité des
 * lignes du fichier (les autres lignes de la collection ne bougent pas). Une ligne du fichier
 * rejoint la ligne identique (carte × état × prix × date × notes) ; un prix, une date ou des notes absents du
 * fichier ne départagent pas : la ligne rejoint alors celle de même carte × état, de préférence
 * sans ces valeurs, et ses valeurs sont conservées. Une seule transaction, requêtes groupées.
 */
export async function importCollectionLines(userId: string, input: ImportInput) {
  const [conditions, printings] = await Promise.all([
    prisma.condition.findMany({ select: { id: true, code: true } }),
    prisma.printing.findMany({
      where: { id: { in: [...new Set(input.lines.map((line) => line.printingId))] }, isActive: true },
      select: { id: true },
    }),
  ]);
  const conditionIds = new Map(conditions.map((condition) => [condition.code, condition.id]));
  const validPrintings = new Set(printings.map((printing) => printing.id));

  // Fusionne les doublons (même carte × état × prix × notes) envoyés dans le même import.
  const merged = new Map<string, ImportInput["lines"][number] & { conditionId: string }>();
  let skipped = 0;
  for (const line of input.lines) {
    const conditionId = conditionIds.get(line.conditionCode);
    if (!conditionId || !validPrintings.has(line.printingId)) {
      skipped += 1;
      continue;
    }
    const key = JSON.stringify([
      line.printingId,
      line.conditionCode,
      line.notes === undefined ? "?" : lineNotes(line.notes),
      line.purchasePrice === undefined ? "?" : linePrice(line.purchasePrice),
      line.purchasePrice ? line.purchaseCurrency || "EUR" : null,
      line.purchasedAt === undefined ? "?" : lineDate(line.purchasedAt),
    ]);
    const current = merged.get(key);
    merged.set(key, current ? { ...current, quantity: current.quantity + line.quantity } : { ...line, conditionId });
  }
  if (merged.size === 0) fail("collection.noValidCard");

  const existing = await prisma.collectionItem.findMany({
    where: { userId, printingId: { in: [...new Set([...merged.values()].map((line) => line.printingId))] } },
    include,
    orderBy: { addedAt: "asc" },
  });
  const existingByCard = new Map<string, CollectionItemDTO[]>();
  for (const item of existing) {
    existingByCard.set(item.printingId, [...(existingByCard.get(item.printingId) ?? []), toDTO(item)]);
  }

  const creates = [];
  const updates = new Map<string, { quantity: number }>();
  for (const line of merged.values()) {
    const current = matchLine(existingByCard.get(line.printingId) ?? [], line);
    if (current) {
      const base = updates.get(current.id)?.quantity ?? (input.mode === "add" ? current.quantity : 0);
      updates.set(current.id, { quantity: capped(base + line.quantity) });
    } else {
      creates.push({
        userId,
        printingId: line.printingId,
        conditionId: line.conditionId,
        quantity: capped(line.quantity),
        ...newLineFields(line),
      });
    }
  }

  await prisma.$transaction([
    ...(creates.length ? [prisma.collectionItem.createMany({ data: creates })] : []),
    ...[...updates].map(([id, data]) => prisma.collectionItem.update({ where: { id }, data })),
  ]);
  return { created: creates.length, updated: updates.size, skipped };
}

/**
 * Modifie une ligne. Si elle devient identique à une autre ligne de la même carte
 * (état, prix, date d'achat et notes), les deux sont fusionnées.
 */
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
    if (!current) fail("collection.lineNotFound");
    if (input.quantity != null && input.quantity <= 0) {
      await tx.collectionItem.delete({ where: { id: current.id } });
      return { item: null, deletedId: current.id };
    }
    const conditionCode = input.conditionCode ?? current.condition.code;
    const condition = await tx.condition.findUnique({ where: { code: conditionCode } });
    if (!condition) fail("collection.conditionNotFound");
    const purchasePrice = linePrice(input.purchasePrice === undefined ? current.purchasePrice : input.purchasePrice);
    const fields = {
      notes: lineNotes(input.notes === undefined ? current.notes : input.notes),
      purchasePrice,
      purchaseCurrency:
        purchasePrice == null
          ? null
          : (input.purchaseCurrency === undefined ? current.purchaseCurrency : input.purchaseCurrency) || "EUR",
      purchasedAt: purchaseDay(input.purchasedAt === undefined ? current.purchasedAt : input.purchasedAt),
    };
    const key = lineKey({ ...fields, conditionCode });
    const siblings = await tx.collectionItem.findMany({
      where: { userId, printingId: current.printingId, conditionId: condition.id, id: { not: current.id } },
      include,
      orderBy: { addedAt: "asc" },
    });
    const target = siblings.find((item) => lineKey({ ...item, conditionCode }) === key);
    if (target) {
      const saved = await tx.collectionItem.update({
        where: { id: target.id },
        data: { quantity: capped((input.quantity ?? current.quantity) + target.quantity) },
        include,
      });
      await tx.collectionItem.delete({ where: { id: current.id } });
      return { item: toDTO(saved), deletedId: current.id };
    }
    const saved = await tx.collectionItem.update({
      where: { id: current.id },
      data: { conditionId: condition.id, quantity: input.quantity ?? current.quantity, ...fields },
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
