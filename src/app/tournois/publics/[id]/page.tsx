import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicTournamentPage } from "@/components/public/PublicTournamentPage";
import { findPublicTournament } from "@/lib/tournament/directory";
import { buildPublicView } from "@/lib/tournament/public-view";

type PageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = await findPublicTournament((await params).id);
  if (!t) return { title: "Tournoi introuvable" };
  const when = t.startsAt
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short", ...(t.timeZone ? { timeZone: t.timeZone } : {}) }).format(t.startsAt)
    : null;
  const where = [t.venueName, t.city].filter(Boolean).join(", ");
  return {
    title: `${t.name} · Tournoi Cyberpunk TCG`,
    description: [when, where, t.shop && t.shop.status !== "rejected" ? t.shop.name : null].filter(Boolean).join(" · "),
  };
}

export default async function PublicTournamentDetailPage({ params }: PageProps) {
  const t = await findPublicTournament((await params).id);
  if (!t) notFound();
  return <PublicTournamentPage tournament={buildPublicView(t)} />;
}
