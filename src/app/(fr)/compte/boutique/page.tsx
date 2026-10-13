import { ShopManager } from "@/components/shops/ShopManager";
import { privateMetadata } from "@/lib/seo/metadata";

// Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée.
export const metadata = privateMetadata;

export default function MyShopPage() {
  return <ShopManager />;
}
