import { NextResponse } from "next/server";
import { loadCatalogCached, loadCollection, requireUser } from "@/lib/catalog";
import {
  aggregateCollection,
  computeProgress,
  progressByRarity,
  releasedChecklist,
  spentAmount,
  viewOwnership,
} from "@/lib/logic";
import { ENGLISH_SET_ID, FRENCH_SET_ID } from "@/lib/reference-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const [catalog, items] = await Promise.all([loadCatalogCached(), loadCollection(user.id)]);
  const agg = aggregateCollection(items);
  const english = releasedChecklist(catalog.printings, ENGLISH_SET_ID) ?? [];
  const french = releasedChecklist(catalog.printings, FRENCH_SET_ID) ?? [];
  const englishOwnership = viewOwnership(ENGLISH_SET_ID, catalog.printings, agg);
  const frenchOwnership = viewOwnership(FRENCH_SET_ID, catalog.printings, agg);
  const requested = new URL(request.url).searchParams.get("scope");
  const scope = requested === "fr" ? "fr" : "en";
  const scoped = scope === "fr" ? french : english;
  const ownership = scope === "fr" ? frenchOwnership : englishOwnership;
  return NextResponse.json({
    scope,
    mainSetCode: scope === "fr" ? FRENCH_SET_ID : ENGLISH_SET_ID,
    progress: computeProgress(scoped, ownership),
    english: computeProgress(english, englishOwnership),
    french: computeProgress(french, frenchOwnership),
    rarities: progressByRarity(scoped, ownership),
    hasPrices: catalog.hasPrices,
    spent: spentAmount(items),
  });
}
