import { SharedBinderHome } from "@/components/SharedBinderHome";
import { SharedBinderProvider } from "@/components/SharedBinderProvider";

type PageProps = { params: Promise<{ token: string }> };

export default async function SharedBinderPage({ params }: PageProps) {
  const { token } = await params;
  return (
    <SharedBinderProvider token={token}>
      <SharedBinderHome />
    </SharedBinderProvider>
  );
}
