import { timingSafeEqual } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { CATALOG_CACHE_TAG } from "@/lib/catalog";
import { checkPriceGuideFreshness, recordJobFailure, recordJobSuccess } from "@/lib/job-status";
import { reportError } from "@/lib/monitoring";
import { importPrices } from "@/lib/price-import";
import { prisma } from "@/lib/prisma";
import { purgeExpiredRateLimits } from "@/lib/rate-limit";

// Appelé chaque jour par Vercel Cron (vercel.json). Vercel envoie « Authorization: Bearer $CRON_SECRET ».
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const JOB_NAME = "import-prices";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  // Ménage annexe : un échec ici ne doit pas empêcher l'import.
  await purgeExpiredRateLimits().catch((error) => reportError("purge rate-limit", error));

  try {
    // Seul /tmp est inscriptible sur Vercel.
    const result = await importPrices(prisma, { cacheDir: path.join(tmpdir(), "cardmarket") });
    if (result.status === "imported") revalidateTag(CATALOG_CACHE_TAG, "max");
    console.log(JSON.stringify(result));
    await recordJobSuccess(JOB_NAME);
    await checkPriceGuideFreshness();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await recordJobFailure(JOB_NAME, error);
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
