import { SettingsScreen } from "@/components/SettingsScreen";
import { privateMetadata } from "@/lib/seo/metadata";

// Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée.
export const metadata = privateMetadata;

export default function SettingsPage() {
  return <SettingsScreen />;
}
