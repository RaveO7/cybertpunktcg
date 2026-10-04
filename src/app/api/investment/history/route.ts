import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { loadPortfolioPriceHistory, loadPrintingPriceHistory, loadReferencePrices } from "@/lib/investment-history";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  const url = new URL(request.url);
  const printingId = url.searchParams.get("printingId");
  if (printingId) {
    const points = await loadPrintingPriceHistory(printingId);
    return NextResponse.json({ kind: "printing", printingId, points });
  }

  if (url.searchParams.has("referenceDay")) {
    const raw = url.searchParams.get("referenceDay")?.trim() ?? "";
    const day = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
    const prices = await loadReferencePrices({ userId: user.id, day });
    return NextResponse.json({ kind: "reference", day, prices });
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
