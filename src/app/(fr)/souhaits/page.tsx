import { notFound } from "next/navigation";
import { WishlistScreen } from "@/components/WishlistScreen";
import { privateMetadata } from "@/lib/seo/metadata";
import { WISHLIST_ENABLED } from "@/lib/site";

// Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée.
export const metadata = privateMetadata;

export default function WishlistPage() {
  // Fonctionnalité pas encore publiée (cf. WISHLIST_ENABLED).
  if (!WISHLIST_ENABLED) notFound();
  return <WishlistScreen />;
}
