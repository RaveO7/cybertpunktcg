import { getTranslations } from "next-intl/server";
import { ClaimScreen } from "@/components/tournament/LinkScreens";
import { shareTokenSchema } from "@/lib/api-schemas";
import { privateMetadata } from "@/lib/seo/metadata";
import { claimTokenStatus } from "@/lib/tournament/player-auth";

// Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée.
export const metadata = privateMetadata;

type PageProps = { params: Promise<{ token: string }> };

export default async function TournamentClaimPage({ params }: PageProps) {
  const { token } = await params;
  // QR expiré, déjà utilisé ou régénéré : message tout de suite, sans bouton (lecture seule).
  const status = shareTokenSchema.safeParse(token).success ? await claimTokenStatus(token) : "invalid";
  const t = await getTranslations();
  const error = status === "valid" ? null : t(status === "expired" ? "api.tournaments.expiredClaim" : "api.tournaments.invalidClaim");
  return <ClaimScreen token={token} error={error} />;
}
