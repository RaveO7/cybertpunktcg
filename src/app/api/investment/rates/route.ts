import { NextResponse } from "next/server";
import { requireUser } from "@/lib/catalog";
import { loadExchangeRates } from "@/lib/exchange-rates";
import { prisma } from "@/lib/prisma";
import { exchangeRatesSchema, readJsonBody } from "@/lib/api-schemas";
import { sessionRequired } from "@/lib/api-response";

export const dynamic = "force-dynamic";

/**
 * Taux BCE des couples « devise:jour » demandés (achats et ventes en devise de la page Investissement) :
 * `{ rates: { "USD:2024-03-01": 1.0956 } }`, unités de devise pour 1 EUR. La liste passe dans le corps.
 */
export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return sessionRequired(request);
  const parsed = await readJsonBody(request, exchangeRatesSchema);
  if (!parsed.ok) return parsed.response;
  return NextResponse.json({ rates: await loadExchangeRates(prisma, parsed.data.keys) });
}
