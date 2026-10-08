import { notFound } from "next/navigation";
import { SharedBinderHome } from "@/components/SharedBinderHome";
import { SharedBinderProvider } from "@/components/SharedBinderProvider";
import { shareExists } from "@/lib/share";

type PageProps = { params: Promise<{ token: string }> };

export default async function SharedBinderPage({ params }: PageProps) {
  const { token } = await params;
  if (!(await shareExists(token))) notFound();
  return (
    <SharedBinderProvider token={token}>
      <SharedBinderHome />
    </SharedBinderProvider>
  );
}
