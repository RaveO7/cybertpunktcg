import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { LOGO_MAX_BYTES, readShopLogo, setShopLogo } from "@/lib/shops/shops";
import { errorResponse, sessionRequired } from "@/lib/tournament/http";

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

/** Téléversement : le corps est le fichier image brut (PNG, JPEG ou WebP, 2 Mo maximum). */
export async function PUT(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired();
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > LOGO_MAX_BYTES) return NextResponse.json({ error: "Logo trop lourd (2 Mo maximum)." }, { status: 413 });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.byteLength === 0) return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  try {
    return NextResponse.json({ shop: await setShopLogo((await context.params).slug, user, bytes) });
  } catch (error) {
    return errorResponse("shop-logo", error);
  }
}

export async function DELETE(request: Request, context: Context) {
  const user = await requireUser(request);
  if (!user) return sessionRequired();
  try {
    return NextResponse.json({ shop: await setShopLogo((await context.params).slug, user, null) });
  } catch (error) {
    return errorResponse("shop-logo", error);
  }
}
