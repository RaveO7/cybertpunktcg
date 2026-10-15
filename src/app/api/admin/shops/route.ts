import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/catalog";
import { listShopsForReview, type ShopStatus } from "@/lib/shops/shops";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

const STATUSES: ShopStatus[] = ["pending", "verified", "rejected"];

/** File de validation des boutiques (administrateurs). */
export async function GET(request: Request) {
  if (!(await requireAdmin(request))) return apiError(request, "common.adminOnly", 403);
  const status = new URL(request.url).searchParams.get("status") ?? "pending";
  if (!STATUSES.includes(status as ShopStatus)) return apiError(request, "common.invalidStatus", 400);
  return NextResponse.json({ shops: await listShopsForReview(status as ShopStatus) });
}
