import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { CollectionItemDTO } from "@/lib/types";

export function createShareToken() {
  return randomBytes(24).toString("base64url");
}

export function sharePath(token: string) {
  return `/classeur/${token}`;
}

export async function getShareForUser(userId: string) {
  return prisma.collectionShare.findUnique({ where: { userId } });
}

export async function createOrRotateShare(userId: string) {
  const token = createShareToken();
  return prisma.collectionShare.upsert({
    where: { userId },
    create: { userId, token },
    update: { token, createdAt: new Date() },
  });
}

export async function revokeShare(userId: string) {
  await prisma.collectionShare.deleteMany({ where: { userId } });
}

export async function loadSharedBinder(token: string) {
  const share = await prisma.collectionShare.findUnique({
    where: { token },
    include: { user: { select: { displayName: true } } },
  });
  if (!share) return null;

  const rows = await prisma.collectionItem.findMany({
    where: { userId: share.userId, quantity: { gt: 0 } },
    include: { condition: true },
    orderBy: { addedAt: "asc" },
  });

  const items: CollectionItemDTO[] = rows.map((item) => ({
    id: item.id,
    printingId: item.printingId,
    conditionCode: item.condition.code,
    conditionName: item.condition.name,
    quantity: item.quantity,
    notes: null,
    purchasePrice: null,
    purchaseCurrency: null,
    addedAt: item.addedAt.toISOString(),
  }));

  return {
    owner: { displayName: share.user.displayName },
    items,
    createdAt: share.createdAt.toISOString(),
  };
}

export function absoluteShareUrl(request: Request, token: string) {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured) return `${configured}${sharePath(token)}`;
  return new URL(sharePath(token), request.url).toString();
}
