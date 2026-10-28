import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { loadPortfolioPriceHistory, loadPrintingPriceHistory, loadReferencePrices } from "@/lib/investment-history";
import { portfolioHistorySchema, readJsonBody } from "@/lib/api-schemas";
import { sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);

  const url = new URL(request.url);
  const printingId = url.searchParams.get("printingId");
  if (printingId) {
    const points = await loadPrintingPriceHistory(printingId);
    return NextResponse.json({ kind: "printing", printingId, points });
  }

  if (url.searchParams.has("referenceDays")) {
    // Durée de la période en jours ; vide = tout l'historique.
    const raw = url.searchParams.get("referenceDays")?.trim() ?? "";
    const days = /^\d{1,5}$/.test(raw) ? Number(raw) : null;
    const reference = await loadReferencePrices({ userId: user.id, days });
    return NextResponse.json({ kind: "reference", ...reference });
  }

  const setCode = url.searchParams.get("set")?.trim() || undefined;
  const language = url.searchParams.get("language")?.trim() || undefined;
  const history = await loadPortfolioPriceHistory({
    userId: user.id,
    setCode: setCode && setCode !== "all" ? setCode : undefined,
    language: language || undefined,
  });
  return NextResponse.json({
    kind: "portfolio",
    set: setCode ?? "all",
    language: language ?? "",
    ...history,
  });
}

/** Courbe d'un ensemble d'exemplaires (sélection ou filtres du détail) : la liste, trop longue pour l'URL, passe dans le corps. */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const parsed = await readJsonBody(request, portfolioHistorySchema);
  if (!parsed.ok) return parsed.response;
  const history = await loadPortfolioPriceHistory({ userId: user.id, itemIds: parsed.data.items });
  return NextResponse.json({ kind: "portfolio", ...history });
}
