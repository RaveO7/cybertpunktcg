import { notFound } from "next/navigation";
import { SharedBinderCards } from "@/components/SharedBinderCards";
import { SharedBinderProvider } from "@/components/SharedBinderProvider";
import { shareExists } from "@/lib/share";
import { privateMetadata } from "@/lib/seo/metadata";

// Page privée, derrière connexion ou ouverte par un lien à jeton : jamais indexée.
export const metadata = privateMetadata;

type PageProps = { params: Promise<{ token: string }> };

export default async function SharedBinderCardsPage({ params }: PageProps) {
  const { token } = await params;
  if (!(await shareExists(token))) notFound();
  return (
    <SharedBinderProvider token={token}>
      <SharedBinderCards />
    </SharedBinderProvider>
  );
}
