import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { formatRoute } from "@/i18n/match";
import { requestLocale } from "@/lib/api-response";
import { prisma } from "@/lib/prisma";
import { createShareToken, isShareTokenFormat } from "@/lib/share-token";
import type { CollectionItemDTO } from "@/lib/types";

export { createShareToken };

/** Adresse du classeur partagé, dans la langue de celui qui partage. */
export function sharePath(token: string, locale: Locale = DEFAULT_LOCALE) {
  return formatRoute("/classeur/[token]", locale, { token });
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
  if (!isShareTokenFormat(token)) return false;
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
  const path = sharePath(token, requestLocale(request));
  if (configured) return `${configured}${path}`;
  return new URL(path, request.url).toString();
}
