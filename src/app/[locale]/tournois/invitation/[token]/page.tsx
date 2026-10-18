import { getTranslations } from "next-intl/server";
import { InviteScreen } from "@/components/tournament/LinkScreens";
import { shareTokenSchema } from "@/lib/api-schemas";
import { privateMetadata } from "@/lib/seo/metadata";
import { organizerInviteUsable } from "@/lib/tournament/commands";

// Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée.
export const metadata = privateMetadata;

type PageProps = { params: Promise<{ token: string }> };

export default async function TournamentInvitePage({ params }: PageProps) {
  const { token } = await params;
  // Invitation expirée, déjà acceptée ou tournoi supprimé : message tout de suite, sans bouton.
  const usable = shareTokenSchema.safeParse(token).success && (await organizerInviteUsable(token));
  const t = await getTranslations();
  return <InviteScreen token={token} error={usable ? null : t("api.tournaments.invalidInvite")} />;
}
