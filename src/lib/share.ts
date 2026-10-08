import { randomBytes } from "node:crypto";
import { shareTokenSchema } from "@/lib/api-schemas";
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

/** Lien valide et actif ? (pour répondre 404 dès le rendu serveur). */
export async function shareExists(token: string) {
  if (!shareTokenSchema.safeParse(token).success) return false;
  const share = await prisma.collectionShare.findUnique({ where: { token }, select: { id: true } });
  return share !== null;
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
