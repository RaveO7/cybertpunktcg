import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { LOGO_MAX_BYTES, readShopLogo, setShopLogo } from "@/lib/shops/shops";
import { errorResponse, sessionRequired } from "@/lib/tournament/http";
import { apiError } from "@/lib/api-response";
import { limitUserWrites } from "@/lib/rate-limit-http";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

/** Logo (WebP 256×256). L'URL porte ?v=<date de mise à jour> : cache long sans risque. */
export async function GET(_request: Request, context: Context) {
  const logo = await readShopLogo((await context.params).slug);
  if (!logo) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(logo), {
    headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable" },
  });
}

/** Corps de la requête, ou `null` dès qu'il dépasse `max` octets (sans tout charger en mémoire). */
async function readBounded(request: Request, max: number) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Téléversement : le corps est le fichier image brut (PNG, JPEG ou WebP, 2 Mo maximum). */
export async function PUT(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const limited = await limitUserWrites(request, "shop-logo", user.id, 10, 10 * 60_000);
  if (limited) return limited;
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > LOGO_MAX_BYTES) return apiError(request, "shops.logoTooLarge", 413, { values: { max: LOGO_MAX_BYTES / 1024 / 1024 } });
  // Lecture bornée : l'en-tête content-length peut manquer (corps en morceaux) ou mentir.
  const bytes = await readBounded(request, LOGO_MAX_BYTES);
  if (!bytes) return apiError(request, "shops.logoTooLarge", 413, { values: { max: LOGO_MAX_BYTES / 1024 / 1024 } });
  if (bytes.byteLength === 0) return apiError(request, "shops.noFile", 400);
  try {
    return NextResponse.json({ shop: await setShopLogo((await context.params).slug, user, bytes) });
  } catch (error) {
    return errorResponse(request, "shop-logo", error);
  }
}

export async function DELETE(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const limited = await limitUserWrites(request, "shop-logo", user.id, 10, 10 * 60_000);
  if (limited) return limited;
  try {
    return NextResponse.json({ shop: await setShopLogo((await context.params).slug, user, null) });
  } catch (error) {
    return errorResponse(request, "shop-logo", error);
  }
}
