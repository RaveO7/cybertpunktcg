import { SharedBinderCards } from "@/components/SharedBinderCards";
import { SharedBinderProvider } from "@/components/SharedBinderProvider";

type PageProps = { params: Promise<{ token: string }> };

export default async function SharedBinderCardsPage({ params }: PageProps) {
  const { token } = await params;
  return (
    <SharedBinderProvider token={token}>
      <SharedBinderCards />
    </SharedBinderProvider>
  );
}
