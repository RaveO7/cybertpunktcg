import { NextResponse } from "next/server";
import { readJsonBody, shareSchema } from "@/lib/api-schemas";
import { requireUser } from "@/lib/catalog";
import {
  absoluteShareUrl,
  createOrRotateShare,
  getShareForUser,
  revokeShare,
  sharePath,
} from "@/lib/share";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const share = await getShareForUser(user.id);
  if (!share) return NextResponse.json({ active: false });
  return NextResponse.json({
    active: true,
    token: share.token,
    path: sharePath(share.token),
    url: absoluteShareUrl(request, share.token),
    createdAt: share.createdAt.toISOString(),
  });
}

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const parsed = await readJsonBody(request, shareSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const existing = await getShareForUser(user.id);
  if (existing && !body?.rotate) {
    return NextResponse.json({
      active: true,
      token: existing.token,
      path: sharePath(existing.token),
      url: absoluteShareUrl(request, existing.token),
      createdAt: existing.createdAt.toISOString(),
    });
  }
  const share = await createOrRotateShare(user.id);
  return NextResponse.json({
    active: true,
    token: share.token,
    path: sharePath(share.token),
    url: absoluteShareUrl(request, share.token),
    createdAt: share.createdAt.toISOString(),
  });
}

export async function DELETE(request: Request) {
  const user = await requireUser(request);
  if (!user) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  await revokeShare(user.id);
  return NextResponse.json({ active: false });
}
