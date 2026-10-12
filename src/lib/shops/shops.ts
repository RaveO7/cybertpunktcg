// Boutiques : profil géré par un compte, page publique, vérification par un administrateur.
// Cf. specs/shops/profile et specs/shops/verification. Les refus métier réutilisent
// TournamentError (message affichable + statut HTTP), déjà traduit en réponse par errorResponse.

import { Prisma, type Shop } from "@prisma/client";
import type { ShopCreateInput, ShopUpdateInput } from "@/lib/api-schemas";
import { boundingBox, haversineKm, roundDistanceKm, type Point } from "@/lib/geo/distance";
import { cityKey, placeFromRow, toPlaceColumns, type Place } from "@/lib/geo/location";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/tournament/errors";

export const MAX_SHOPS_PER_OWNER = 5;
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_SIZE = 256;

/** Adresses de page qui entreraient en conflit avec des routes ou prêteraient à confusion. */
export const RESERVED_SLUGS = new Set(["nouveau", "nouvelle", "admin", "api", "carte", "boutique", "boutiques", "edit", "compte", "new", "mine"]);

export type ShopStatus = "pending" | "verified" | "rejected";
export type ShopSocial = { kind: string; url: string };

export type ShopSummary = {
  id: string;
  slug: string;
  name: string;
  city: string;
  region: string | null;
  country: string;
  lat: number;
  lng: number;
  verified: boolean;
  logoUrl: string | null;
  distanceKm: number | null;
};

export type ShopDetail = ShopSummary & {
  description: string | null;
  website: string | null;
  socials: ShopSocial[];
  phone: string | null;
  contactEmail: string | null;
  hours: string | null;
  place: Place;
};

export type OwnedShop = ShopDetail & {
  status: ShopStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
};

export type AdminShop = OwnedShop & { owner: { id: string; email: string | null; displayName: string } };

/** « Arasaka Games & Co » → « arasaka-games-co ». */
export function slugify(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/g, "");
  return slug.length >= 2 ? slug : `boutique-${slug || "jeux"}`;
}

export function logoUrl(shop: Pick<Shop, "slug" | "logoUpdatedAt">) {
  return shop.logoUpdatedAt ? `/api/shops/${shop.slug}/logo?v=${shop.logoUpdatedAt.getTime()}` : null;
}

function parseSocials(json: string | null): ShopSocial[] {
  if (!json) return [];
  try {
    const value = JSON.parse(json) as unknown;
    return Array.isArray(value)
      ? value.filter((item): item is ShopSocial => typeof item?.kind === "string" && typeof item?.url === "string")
      : [];
  } catch {
    return [];
  }
}

type ShopRow = Omit<Shop, "logo">;

/** Toutes les colonnes sauf le logo (binaire, servi par sa propre route). */
export const shopSelect = {
  id: true,
  slug: true,
  ownerId: true,
  name: true,
  description: true,
  website: true,
  socialsJson: true,
  phone: true,
  contactEmail: true,
  hours: true,
  venueName: true,
  address: true,
  postalCode: true,
  city: true,
  cityKey: true,
  region: true,
  country: true,
  lat: true,
  lng: true,
  logoUpdatedAt: true,
  status: true,
  reviewNote: true,
  reviewedAt: true,
  reviewedById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ShopSelect;

export function toSummary(shop: ShopRow, from?: Point | null): ShopSummary {
  return {
    id: shop.id,
    slug: shop.slug,
    name: shop.name,
    city: shop.city,
    region: shop.region,
    country: shop.country,
    lat: shop.lat,
    lng: shop.lng,
    verified: shop.status === "verified",
    logoUrl: logoUrl(shop),
    distanceKm: from ? roundDistanceKm(haversineKm(from, shop)) : null,
  };
}

export function toDetail(shop: ShopRow): ShopDetail {
  return {
    ...toSummary(shop),
    description: shop.description,
    website: shop.website,
    socials: parseSocials(shop.socialsJson),
    phone: shop.phone,
    contactEmail: shop.contactEmail,
    hours: shop.hours,
    place: placeFromRow(shop)!,
  };
}

export function toOwned(shop: ShopRow): OwnedShop {
  return {
    ...toDetail(shop),
    status: shop.status as ShopStatus,
    reviewNote: shop.reviewNote,
    reviewedAt: shop.reviewedAt?.toISOString() ?? null,
    createdAt: shop.createdAt.toISOString(),
  };
}

// --- Gérant ----------------------------------------------------------------------------------

async function slugTaken(slug: string, exceptId?: string) {
  if (RESERVED_SLUGS.has(slug)) return true;
  const row = await prisma.shop.findUnique({ where: { slug }, select: { id: true } });
  return row !== null && row.id !== exceptId;
}

async function freeSlug(base: string) {
  for (let n = 1; n < 1000; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    if (!(await slugTaken(candidate))) return candidate;
  }
  return fail("Impossible de choisir une adresse de page, changez le nom.", 409);
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export async function createShop(ownerId: string, input: ShopCreateInput): Promise<OwnedShop> {
  const count = await prisma.shop.count({ where: { ownerId } });
  if (count >= MAX_SHOPS_PER_OWNER) fail(`Vous gérez déjà ${MAX_SHOPS_PER_OWNER} boutiques.`, 409);
  if (input.slug && (await slugTaken(input.slug))) fail("Cette adresse de page est déjà prise.", 409);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = input.slug ?? (await freeSlug(slugify(input.name)));
    try {
      const shop = await prisma.shop.create({
        data: {
          ownerId,
          slug,
          name: input.name,
          description: input.description ?? null,
          website: input.website ?? null,
          socialsJson: input.socials?.length ? JSON.stringify(input.socials) : null,
          phone: input.phone ?? null,
          contactEmail: input.contactEmail ?? null,
          hours: input.hours ?? null,
          ...toPlaceColumns(input.place),
          status: "pending",
        },
        select: shopSelect,
      });
      return toOwned(shop);
    } catch (error) {
      // Adresse prise entre la vérification et l'insertion.
      if (isUniqueViolation(error) && !input.slug) continue;
      if (isUniqueViolation(error)) fail("Cette adresse de page est déjà prise.", 409);
      throw error;
    }
  }
  return fail("Impossible de choisir une adresse de page, réessayez.", 409);
}

/** Boutique que `user` peut modifier : la sienne, ou n'importe laquelle pour un administrateur. */
async function editableShop(slug: string, user: { id: string; role: string }) {
  const shop = await prisma.shop.findUnique({ where: { slug }, select: shopSelect });
  if (!shop) fail("Boutique introuvable.", 404);
  if (shop.ownerId !== user.id && user.role !== "admin") fail("Vous ne gérez pas cette boutique.", 403);
  return shop;
}

function samePlace(a: Place, b: Place) {
  return a.address === b.address && a.city === b.city && a.country === b.country && a.lat === b.lat && a.lng === b.lng;
}

export async function updateShop(slug: string, user: { id: string; role: string }, input: ShopUpdateInput): Promise<OwnedShop> {
  const shop = await editableShop(slug, user);
  if (input.slug && input.slug !== shop.slug && (await slugTaken(input.slug, shop.id))) {
    fail("Cette adresse de page est déjà prise.", 409);
  }
  const current = placeFromRow(shop)!;
  const identityChanged =
    (input.name !== undefined && input.name !== shop.name) || (input.place !== undefined && !samePlace(input.place, current));
  // Une boutique vérifiée qui change de nom ou d'adresse doit être revalidée ; une boutique
  // refusée corrigée retourne dans la file quand le gérant la soumet de nouveau.
  const backToReview = (shop.status === "verified" && identityChanged) || (shop.status === "rejected" && input.resubmit === true);
  try {
    const updated = await prisma.shop.update({
      where: { id: shop.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.website !== undefined ? { website: input.website } : {}),
        ...(input.socials !== undefined ? { socialsJson: input.socials.length ? JSON.stringify(input.socials) : null } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail } : {}),
        ...(input.hours !== undefined ? { hours: input.hours } : {}),
        ...(input.place !== undefined ? toPlaceColumns(input.place) : {}),
        ...(backToReview ? { status: "pending", reviewNote: null, reviewedAt: null, reviewedById: null } : {}),
      },
      select: shopSelect,
    });
    return toOwned(updated);
  } catch (error) {
    if (isUniqueViolation(error)) fail("Cette adresse de page est déjà prise.", 409);
    throw error;
  }
}

/** Supprime la boutique ; ses tournois sont conservés, détachés (onDelete: SetNull). */
export async function deleteShop(slug: string, user: { id: string; role: string }) {
  const shop = await editableShop(slug, user);
  await prisma.shop.delete({ where: { id: shop.id } });
}

export async function listOwnedShops(ownerId: string): Promise<OwnedShop[]> {
  const shops = await prisma.shop.findMany({ where: { ownerId }, orderBy: { createdAt: "asc" }, select: shopSelect });
  return shops.map(toOwned);
}

export async function getOwnedShop(slug: string, user: { id: string; role: string }): Promise<OwnedShop> {
  return toOwned(await editableShop(slug, user));
}

/** Tournois rattachés à une boutique (vue du gérant, privés compris). */
export async function listAttachedTournaments(shopId: string) {
  const rows = await prisma.tournament.findMany({
    where: { shopId },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    take: 100,
    select: { id: true, name: true, status: true, visibility: true, startsAt: true, timeZone: true },
  });
  return rows.map((row) => ({ ...row, startsAt: row.startsAt?.toISOString() ?? null }));
}

/** Le gérant retire un tournoi de sa boutique (le tournoi reste intact). */
export async function detachTournament(slug: string, tournamentId: string, user: { id: string; role: string }) {
  const shop = await editableShop(slug, user);
  const { count } = await prisma.tournament.updateMany({
    where: { id: tournamentId, shopId: shop.id },
    data: { shopId: null, revision: { increment: 1 } },
  });
  if (count === 0) fail("Ce tournoi n'est pas rattaché à cette boutique.", 404);
}

// --- Logo ------------------------------------------------------------------------------------

const LOGO_FORMATS = new Set(["png", "jpeg", "webp"]);

/** Valide (format réel, poids) puis recadre en carré WebP avant stockage. */
export async function processLogo(bytes: Uint8Array) {
  if (bytes.byteLength > LOGO_MAX_BYTES) fail("Logo trop lourd (2 Mo maximum).", 413);
  const sharp = (await import("sharp")).default;
  let format: string | undefined;
  try {
    format = (await sharp(bytes).metadata()).format;
  } catch {
    fail("Image illisible : utilisez un PNG, JPEG ou WebP.", 415);
  }
  if (!format || !LOGO_FORMATS.has(format)) fail("Format non pris en charge : utilisez un PNG, JPEG ou WebP.", 415);
  return sharp(bytes)
    .rotate()
    .resize(LOGO_SIZE, LOGO_SIZE, { fit: "cover", position: "centre" })
    .webp({ quality: 85 })
    .toBuffer();
}

export async function setShopLogo(slug: string, user: { id: string; role: string }, bytes: Uint8Array | null, now = new Date()) {
  const shop = await editableShop(slug, user);
  const logo = bytes ? await processLogo(bytes) : null;
  const updated = await prisma.shop.update({
    where: { id: shop.id },
    data: { logo: logo ? new Uint8Array(logo) : null, logoUpdatedAt: logo ? now : null },
    select: shopSelect,
  });
  return toOwned(updated);
}

export async function readShopLogo(slug: string) {
  const shop = await prisma.shop.findUnique({ where: { slug }, select: { logo: true, status: true } });
  if (!shop?.logo || shop.status === "rejected") return null;
  return shop.logo;
}

// --- Vérification (administrateurs) ----------------------------------------------------------

export type ReviewDecision = "verify" | "reject" | "revoke";

export async function reviewShop(shopId: string, adminId: string, decision: ReviewDecision, note: string | undefined, now = new Date()) {
  const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true, status: true } });
  if (!shop) fail("Boutique introuvable.", 404);
  if (decision !== "verify" && !note?.trim()) fail("Indiquez le motif du refus.", 400);
  if (decision === "verify" && shop.status === "verified") fail("Cette boutique est déjà vérifiée.", 409);
  if (decision === "reject" && shop.status !== "pending") fail("Seule une boutique en attente peut être refusée.", 409);
  if (decision === "revoke" && shop.status !== "verified") fail("Cette boutique n'est pas vérifiée.", 409);
  const updated = await prisma.shop.update({
    where: { id: shop.id },
    data: {
      status: decision === "verify" ? "verified" : "rejected",
      reviewNote: decision === "verify" ? null : note!.trim(),
      reviewedAt: now,
      reviewedById: adminId,
    },
    select: shopSelect,
  });
  return toOwned(updated);
}

/** File de validation : demandes les plus anciennes d'abord. */
export async function listShopsForReview(status: ShopStatus): Promise<AdminShop[]> {
  const shops = await prisma.shop.findMany({
    where: { status },
    orderBy: status === "pending" ? { updatedAt: "asc" } : { reviewedAt: "desc" },
    take: 200,
    select: { ...shopSelect, owner: { select: { id: true, email: true, displayName: true } } },
  });
  return shops.map(({ owner, ...shop }) => ({ ...toOwned(shop), owner }));
}

// --- Annuaire et page publique ---------------------------------------------------------------

export type ShopDirectoryQuery = {
  country?: string;
  city?: string;
  near?: Point & { radiusKm: number };
  page?: number;
};

export const SHOP_PAGE_SIZE = 50;

export async function listPublicShops(query: ShopDirectoryQuery) {
  const where: Prisma.ShopWhereInput = { status: { not: "rejected" } };
  if (query.country) where.country = query.country;
  if (query.city) where.cityKey = cityKey(query.city);
  if (query.near) {
    const box = boundingBox(query.near, query.near.radiusKm);
    where.lat = { gte: box.minLat, lte: box.maxLat };
    where.lng = { gte: box.minLng, lte: box.maxLng };
  }
  const rows = await prisma.shop.findMany({ where, select: shopSelect, take: 2000 });
  const near = query.near;
  const kept = near ? rows.filter((shop) => haversineKm(near, shop) <= near.radiusKm) : rows;
  kept.sort((a, b) => {
    const verified = Number(b.status === "verified") - Number(a.status === "verified");
    if (verified) return verified;
    if (near) return haversineKm(near, a) - haversineKm(near, b);
    return a.name.localeCompare(b.name, "fr");
  });
  const page = Math.max(1, query.page ?? 1);
  return {
    total: kept.length,
    page,
    pageSize: SHOP_PAGE_SIZE,
    shops: kept.slice((page - 1) * SHOP_PAGE_SIZE, page * SHOP_PAGE_SIZE).map((shop) => toSummary(shop, near)),
  };
}

/** Boutique visible publiquement (non refusée), ou null. */
export async function findPublicShop(slug: string) {
  const shop = await prisma.shop.findUnique({ where: { slug }, select: shopSelect });
  if (!shop || shop.status === "rejected") return null;
  return shop;
}
