import { NextResponse } from "next/server";
import { listConfiguredOAuthProviders } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  const providers = listConfiguredOAuthProviders();
  return NextResponse.json({
    google: providers.includes("google"),
    apple: providers.includes("apple"),
  });
}
